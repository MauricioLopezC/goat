import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { paginate } from "@/lib/pagination";
import { hashPassword } from "@/lib/password";
import { isPatientDocumentChange } from "@/lib/patients";
import { generateTemporaryPassword } from "@/lib/portal";
import type {
  CreatePatientInput,
  PatientAccessInput,
  UpdatePatientInput,
} from "@/lib/validation/patients";

export type CreatedPatientSummary = {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
};

/// Crea un paciente nuevo y, si corresponde, su cobertura por obra social (HU-07).
export async function createPatient(
  input: CreatePatientInput,
  actor: Actor,
): Promise<CreatedPatientSummary> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  const existing = await prisma.patient.findUnique({
    where: {
      documentType_documentNumber: {
        documentType: input.documentType,
        documentNumber: input.documentNumber,
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documentType: true,
      documentNumber: true,
    },
  });

  if (existing) {
    throw new DomainError(
      "DUPLICATE_PATIENT",
      `Ya existe un paciente registrado con ${existing.documentType} ${existing.documentNumber}: ${existing.lastName}, ${existing.firstName}.`,
      {
        documentNumber: [
          `Ya existe un paciente con ${existing.documentType} ${existing.documentNumber}.`,
        ],
      },
      {
        existingPatientId: existing.id,
        existingPatientName: `${existing.lastName}, ${existing.firstName}`,
        documentType: existing.documentType,
        documentNumber: existing.documentNumber,
      },
    );
  }

  if (input.coverageType === "HEALTH_INSURANCE") {
    if (!input.insurancePlanId) {
      throw new DomainError(
        "VALIDATION",
        "El plan de obra social es obligatorio.",
        { insurancePlanId: ["El plan es obligatorio."] },
      );
    }

    const plan = await prisma.insurancePlan.findUnique({
      where: { id: input.insurancePlanId },
      include: { healthInsurer: true },
    });

    if (!plan || !plan.active || !plan.healthInsurer.active) {
      throw new DomainError(
        "VALIDATION",
        "El plan seleccionado no está disponible.",
        { insurancePlanId: ["El plan seleccionado no está activo."] },
      );
    }
  }

  const birthDate = new Date(`${input.birthDate}T00:00:00.000Z`);

  try {
    const created = await prisma.patient.create({
      data: {
        lastName: input.lastName,
        firstName: input.firstName,
        gender: input.gender,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        birthDate,
        phone: input.phone,
        email: input.email,
        coverageType: input.coverageType,
        guardianName: input.guardianName,
        guardianPhone: input.guardianPhone,
        active: true,
        createdById: actor.id,
        ...(input.coverageType === "HEALTH_INSURANCE" && input.insurancePlanId
          ? {
              coverage: {
                create: {
                  insurancePlanId: input.insurancePlanId,
                  memberNumber: input.memberNumber ?? "",
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        documentType: true,
        documentNumber: true,
      },
    });

    return {
      id: created.id,
      firstName: created.firstName,
      lastName: created.lastName,
      documentType: created.documentType,
      documentNumber: created.documentNumber,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.patient.findUnique({
        where: {
          documentType_documentNumber: {
            documentType: input.documentType,
            documentNumber: input.documentNumber,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentType: true,
          documentNumber: true,
        },
      });

      throw new DomainError(
        "DUPLICATE_PATIENT",
        `Ya existe un paciente registrado con ${input.documentType} ${input.documentNumber}${
          duplicate ? `: ${duplicate.lastName}, ${duplicate.firstName}.` : "."
        }`,
        {
          documentNumber: [
            `Ya existe un paciente con ${input.documentType} ${input.documentNumber}.`,
          ],
        },
        duplicate
          ? {
              existingPatientId: duplicate.id,
              existingPatientName: `${duplicate.lastName}, ${duplicate.firstName}`,
              documentType: duplicate.documentType,
              documentNumber: duplicate.documentNumber,
            }
          : {
              documentType: input.documentType,
              documentNumber: input.documentNumber,
            },
      );
    }
    throw error;
  }
}

/// Listado de obras sociales y planes activos para selectores (HU-07).
export async function listHealthInsurers(actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  return prisma.healthInsurer.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      plans: {
        where: { active: true },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export type UpdatedPatientSummary = CreatedPatientSummary;

/// Listado de pacientes, filtrado por documento, apellido o nombre (HU-08).
/// Con menos de 3 caracteres no filtra y devuelve el listado completo. Ordena
/// del registrado más recientemente al más antiguo y pagina de a `PAGE_SIZE`
/// resultados, con el total.
export async function searchPatients(
  query: string,
  page: number,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);

  const trimmed = query.trim();
  const where: Prisma.PatientWhereInput =
    trimmed.length < 3
      ? { active: true }
      : { active: true, OR: patientSearchConditions(trimmed) };

  return paginate(
    page,
    () => prisma.patient.count({ where }),
    (range) =>
      prisma.patient.findMany({
        where,
        include: {
          coverage: {
            include: {
              insurancePlan: {
                include: {
                  healthInsurer: true,
                },
              },
            },
          },
        },
        // El `id` desempata para que ningún paciente salte de página.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...range,
      }),
  );
}

/// Coincidencia parcial en apellido, nombre o documento para `searchPatients`.
function patientSearchConditions(trimmed: string) {
  const orConditions: Prisma.PatientWhereInput[] = [
    { lastName: { contains: trimmed, mode: "insensitive" } },
    { firstName: { contains: trimmed, mode: "insensitive" } },
    { documentNumber: { contains: trimmed, mode: "insensitive" } },
  ];

  // Si se ingresó un documento con puntos/guiones (ej. 40.123.456), normalizar a solo dígitos
  const hasLetters = /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(trimmed);
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!hasLetters && digitsOnly.length >= 3 && digitsOnly !== trimmed) {
    orConditions.push({
      documentNumber: { contains: digitsOnly, mode: "insensitive" },
    });
  }

  return orConditions;
}

/// Ficha completa del paciente por ID (HU-08, HU-17, HU-31).
export async function getPatient(id: number, actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      coverage: {
        include: {
          insurancePlan: {
            include: {
              healthInsurer: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          active: true,
          mustChangePassword: true,
          createdAt: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!patient) {
    throw new DomainError("NOT_FOUND", "El paciente no existe.");
  }

  return patient;
}

/// Modificación de datos y cobertura de un paciente (HU-08, HU-17, HU-31).
export async function updatePatient(
  input: UpdatePatientInput,
  actor: Actor,
): Promise<UpdatedPatientSummary> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  const existing = await prisma.patient.findUnique({
    where: { id: input.id },
    include: { coverage: true },
  });

  if (!existing) {
    throw new DomainError("NOT_FOUND", "El paciente no existe.");
  }

  if (isPatientDocumentChange(existing, input)) {
    throw new DomainError(
      "VALIDATION",
      "El documento de un paciente no se puede modificar.",
      {
        documentNumber: [
          "El tipo y el número de documento no se modifican una vez creado el paciente.",
        ],
      },
    );
  }

  if (input.coverageType === "HEALTH_INSURANCE") {
    if (!input.insurancePlanId) {
      throw new DomainError(
        "VALIDATION",
        "El plan de obra social es obligatorio.",
        { insurancePlanId: ["El plan es obligatorio."] },
      );
    }

    const plan = await prisma.insurancePlan.findUnique({
      where: { id: input.insurancePlanId },
      include: { healthInsurer: true },
    });

    if (!plan || !plan.active || !plan.healthInsurer.active) {
      throw new DomainError(
        "VALIDATION",
        "El plan seleccionado no está disponible.",
        { insurancePlanId: ["El plan seleccionado no está activo."] },
      );
    }
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  if (existing.userId) {
    const emailCollision = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: existing.userId },
      },
      select: { id: true },
    });
    if (emailCollision) {
      throw new DomainError(
        "EMAIL_TAKEN",
        "Ya existe otro usuario registrado con ese email.",
        { email: ["Ya existe otro usuario con ese email."] },
      );
    }
  }

  const birthDate = new Date(`${input.birthDate}T00:00:00.000Z`);

  const updated = await prisma.$transaction(async (tx) => {
    // Si la cobertura pasa a PRIVATE pero antes tenía HEALTH_INSURANCE, remover Coverage
    if (input.coverageType === "PRIVATE" && existing.coverage) {
      await tx.coverage.delete({
        where: { patientId: input.id },
      });
    }

    if (existing.userId) {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          email: normalizedEmail,
        },
      });
    }

    return tx.patient.update({
      where: { id: input.id },
      data: {
        lastName: input.lastName,
        firstName: input.firstName,
        gender: input.gender,
        birthDate,
        phone: input.phone,
        email: normalizedEmail,
        coverageType: input.coverageType,
        guardianName: input.guardianName,
        guardianPhone: input.guardianPhone,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        emergencyContactName: input.emergencyContactName?.trim() || null,
        emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
        emergencyContactRelationship:
          input.emergencyContactName?.trim() &&
          input.emergencyContactPhone?.trim()
            ? input.emergencyContactRelationship?.trim() || null
            : null,
        notes: input.notes?.trim() || null,
        updatedById: actor.id,
        ...(input.coverageType === "HEALTH_INSURANCE" && input.insurancePlanId
          ? {
              coverage: {
                upsert: {
                  create: {
                    insurancePlanId: input.insurancePlanId,
                    memberNumber: input.memberNumber ?? "",
                  },
                  update: {
                    insurancePlanId: input.insurancePlanId,
                    memberNumber: input.memberNumber ?? "",
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        documentType: true,
        documentNumber: true,
      },
    });
  });

  return {
    id: updated.id,
    firstName: updated.firstName,
    lastName: updated.lastName,
    documentType: updated.documentType,
    documentNumber: updated.documentNumber,
  };
}

export type EnabledPatientAccess = {
  patientId: number;
  userId: number;
  email: string;
  temporaryPassword: string;
};

/// Habilita (o restablece) el acceso al portal de un paciente generando una
/// contraseña temporal que deberá cambiar en su primer ingreso (HU-31).
export async function enablePatientAccess(
  input: PatientAccessInput,
  actor: Actor,
): Promise<EnabledPatientAccess> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      active: true,
      userId: true,
    },
  });

  if (!patient) {
    throw new DomainError("NOT_FOUND", "El paciente no existe.");
  }

  if (!patient.active) {
    throw new DomainError(
      "VALIDATION",
      "No se puede habilitar el acceso al portal a un paciente inactivo.",
    );
  }

  const normalizedEmail = patient.email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new DomainError(
      "VALIDATION",
      "El paciente debe tener un correo electrónico registrado en su ficha.",
    );
  }

  const temporaryPassword = generateTemporaryPassword(10);
  const passwordHash = await hashPassword(temporaryPassword);

  let userId = patient.userId ?? 0;

  try {
    await prisma.$transaction(async (tx) => {
      const collision = await tx.user.findFirst({
        where: {
          email: normalizedEmail,
          ...(patient.userId ? { id: { not: patient.userId } } : {}),
        },
        select: { id: true },
      });

      if (collision) {
        throw new DomainError(
          "EMAIL_TAKEN",
          "Ya existe otro usuario en el sistema con el correo electrónico de este paciente.",
          { email: ["Ya existe otro usuario con ese correo electrónico."] },
        );
      }

      if (patient.userId) {
        userId = patient.userId;
        await tx.user.update({
          where: { id: patient.userId },
          data: {
            email: normalizedEmail,
            firstName: patient.firstName,
            lastName: patient.lastName,
            phone: patient.phone,
            passwordHash,
            mustChangePassword: true,
            active: true,
            role: Role.PATIENT,
          },
        });
      } else {
        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            firstName: patient.firstName,
            lastName: patient.lastName,
            phone: patient.phone,
            passwordHash,
            mustChangePassword: true,
            active: true,
            role: Role.PATIENT,
          },
          select: { id: true },
        });
        userId = createdUser.id;

        await tx.patient.update({
          where: { id: patient.id },
          data: { userId: createdUser.id },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DomainError(
        "EMAIL_TAKEN",
        "Ya existe otro usuario en el sistema con el correo electrónico de este paciente.",
        { email: ["Ya existe otro usuario con ese correo electrónico."] },
      );
    }
    throw error;
  }

  return {
    patientId: patient.id,
    userId,
    email: normalizedEmail,
    temporaryPassword,
  };
}

/// Desactiva el acceso al portal de un paciente (HU-31).
export async function disablePatientAccess(
  input: PatientAccessInput,
  actor: Actor,
): Promise<{ patientId: number; active: false }> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: {
      id: true,
      user: { select: { id: true, active: true } },
    },
  });

  if (!patient) {
    throw new DomainError("NOT_FOUND", "El paciente no existe.");
  }

  if (!patient.user || !patient.user.active) {
    throw new DomainError(
      "VALIDATION",
      "El paciente no tiene un acceso activo al portal.",
    );
  }

  await prisma.user.update({
    where: { id: patient.user.id },
    data: { active: false },
  });

  return {
    patientId: patient.id,
    active: false,
  };
}
