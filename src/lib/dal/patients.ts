import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import type {
  CreatePatientInput,
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
                  copayAmount: 0,
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

/// Búsqueda de pacientes por documento, apellido o nombre (HU-08).
/// Mínimo 3 caracteres; devuelve arreglo vacío si tiene menos.
export async function searchPatients(query: string, actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);

  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  return prisma.patient.findMany({
    where: {
      active: true,
      OR: [
        { lastName: { contains: trimmed, mode: "insensitive" } },
        { firstName: { contains: trimmed, mode: "insensitive" } },
        { documentNumber: { contains: trimmed } },
      ],
    },
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
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

/// Ficha completa del paciente por ID (HU-08).
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

/// Modificación de datos y cobertura de un paciente (HU-08).
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

  // Revalidar unicidad si el documento cambió o para asegurar que ningún otro lo tenga
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

  if (duplicate && duplicate.id !== input.id) {
    throw new DomainError(
      "DUPLICATE_PATIENT",
      `Ya existe un paciente registrado con ${duplicate.documentType} ${duplicate.documentNumber}: ${duplicate.lastName}, ${duplicate.firstName}.`,
      {
        documentNumber: [
          `Ya existe un paciente con ${duplicate.documentType} ${duplicate.documentNumber}.`,
        ],
      },
      {
        existingPatientId: duplicate.id,
        existingPatientName: `${duplicate.lastName}, ${duplicate.firstName}`,
        documentType: duplicate.documentType,
        documentNumber: duplicate.documentNumber,
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
    const updated = await prisma.$transaction(async (tx) => {
      // Si la cobertura pasa a PRIVATE pero antes tenía HEALTH_INSURANCE, remover Coverage
      if (input.coverageType === "PRIVATE" && existing.coverage) {
        await tx.coverage.delete({
          where: { patientId: input.id },
        });
      }

      return tx.patient.update({
        where: { id: input.id },
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
          updatedById: actor.id,
          ...(input.coverageType === "HEALTH_INSURANCE" && input.insurancePlanId
            ? {
                coverage: {
                  upsert: {
                    create: {
                      insurancePlanId: input.insurancePlanId,
                      memberNumber: input.memberNumber ?? "",
                      copayAmount: 0,
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
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicatePatient = await prisma.patient.findUnique({
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
          duplicatePatient
            ? `: ${duplicatePatient.lastName}, ${duplicatePatient.firstName}.`
            : "."
        }`,
        {
          documentNumber: [
            `Ya existe un paciente con ${input.documentType} ${input.documentNumber}.`,
          ],
        },
        duplicatePatient
          ? {
              existingPatientId: duplicatePatient.id,
              existingPatientName: `${duplicatePatient.lastName}, ${duplicatePatient.firstName}`,
              documentType: duplicatePatient.documentType,
              documentNumber: duplicatePatient.documentNumber,
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
