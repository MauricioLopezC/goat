import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import type { Actor } from "@/lib/dal/auth";
import type { CreatePatientInput } from "@/lib/validation/patients";

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
      `Ya existe un paciente registrado con el dni: ${existing.documentNumber}`,
      {
        documentNumber: [
          `Ya existe un paciente registrado con el dni: ${existing.documentNumber}`,
        ],
        existingPatientId: [String(existing.id)],
        existingPatientName: [`${existing.lastName}, ${existing.firstName}`],
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
}

/// Listado de obras sociales y planes activos para selectores (HU-07).
export async function listHealthInsurers() {
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
