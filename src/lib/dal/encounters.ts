import "server-only";

import { prisma } from "@/lib/prisma";
import {
  AppointmentEventType,
  AppointmentStatus,
  Role,
} from "@/generated/prisma/enums";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { DomainError } from "@/lib/actions";
import {
  createEncounterSchema,
  updateEncounterSchema,
  type CreateEncounterInput,
  type UpdateEncounterInput,
} from "@/lib/validation/encounters";
import { encounterEditDeadline, isEncounterEditable } from "@/lib/encounters";

export async function createEncounter(
  input: CreateEncounterInput,
  actor: Actor,
) {
  assertRole(actor, Role.PROFESSIONAL);

  const parsed = createEncounterSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError("VALIDATION", "Revisá los datos de la atención.");
  }

  const ownProfessional = await prisma.professional.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!ownProfessional) {
    throw new DomainError(
      "NOT_FOUND",
      "No se encontró el perfil profesional vinculado a tu usuario.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: parsed.data.appointmentId },
      select: {
        id: true,
        professionalId: true,
        status: true,
        startsAt: true,
        encounter: { select: { id: true } },
      },
    });

    if (!appointment) {
      throw new DomainError("NOT_FOUND", "El turno no existe.");
    }

    if (appointment.professionalId !== ownProfessional.id) {
      throw new DomainError(
        "FORBIDDEN",
        "Solo podés registrar la atención de tus propios turnos.",
      );
    }

    if (appointment.encounter) {
      throw new DomainError(
        "DUPLICATE",
        "Este turno ya tiene una atención registrada.",
      );
    }

    const now = new Date();
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        "No se puede registrar atención sobre un turno cancelado.",
      );
    }

    if (appointment.status === AppointmentStatus.EXPIRED) {
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        "No se puede registrar atención sobre un turno vencido.",
      );
    }

    if (
      appointment.status === AppointmentStatus.SCHEDULED &&
      appointment.startsAt > now
    ) {
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        "No se puede registrar la atención antes de que comience el turno.",
      );
    }

    const encounter = await tx.encounter.create({
      data: {
        appointmentId: appointment.id,
        professionalId: ownProfessional.id,
        notes: parsed.data.notes,
        indications: parsed.data.indications ?? null,
      },
    });

    // Si estaba PROGRAMADO, pasa automáticamente a COMPLETADO (HU-25)
    if (appointment.status === AppointmentStatus.SCHEDULED) {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.COMPLETED },
      });

      await tx.appointmentEvent.create({
        data: {
          appointmentId: appointment.id,
          type: AppointmentEventType.COMPLETED,
          reason: "Atención médica registrada",
          userId: actor.id,
        },
      });
    }

    return {
      id: encounter.id,
      appointmentId: appointment.id,
    };
  });
}

export async function updateEncounter(
  input: UpdateEncounterInput,
  actor: Actor,
) {
  assertRole(actor, Role.PROFESSIONAL);

  const parsed = updateEncounterSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError("VALIDATION", "Revisá los datos de la atención.");
  }

  const ownProfessional = await prisma.professional.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!ownProfessional) {
    throw new DomainError(
      "NOT_FOUND",
      "No se encontró el perfil profesional vinculado a tu usuario.",
    );
  }

  const encounter = await prisma.encounter.findUnique({
    where: { id: parsed.data.encounterId },
    select: {
      id: true,
      professionalId: true,
      appointment: {
        select: {
          id: true,
          startsAt: true,
        },
      },
    },
  });

  if (!encounter) {
    throw new DomainError("NOT_FOUND", "La atención no existe.");
  }

  if (encounter.professionalId !== ownProfessional.id) {
    throw new DomainError(
      "FORBIDDEN",
      "Solo el autor puede modificar la atención.",
    );
  }

  const now = new Date();
  if (!isEncounterEditable(encounter.appointment.startsAt, now)) {
    throw new DomainError(
      "DEADLINE_EXCEEDED",
      "El plazo para editar la atención venció al finalizar el día posterior al turno.",
    );
  }

  const updated = await prisma.encounter.update({
    where: { id: encounter.id },
    data: {
      notes: parsed.data.notes,
      indications: parsed.data.indications ?? null,
    },
  });

  return {
    id: updated.id,
    appointmentId: encounter.appointment.id,
  };
}

export async function getEncounter(appointmentId: number, actor: Actor) {
  assertRole(actor, Role.PROFESSIONAL, Role.RECEPTIONIST, Role.MANAGER);

  if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
    throw new DomainError("NOT_FOUND", "El turno no existe.");
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      startsAt: true,
      professionalId: true,
      patientId: true,
      encounter: {
        select: {
          id: true,
          appointmentId: true,
          notes: true,
          indications: true,
          createdAt: true,
          updatedAt: true,
          professional: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!appointment) {
    throw new DomainError("NOT_FOUND", "El turno no existe.");
  }

  let ownProfessional: { id: number } | null = null;
  if (actor.role === Role.PROFESSIONAL) {
    ownProfessional = await prisma.professional.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });

    if (!ownProfessional) {
      throw new DomainError(
        "NOT_FOUND",
        "No se encontró el perfil profesional vinculado a tu usuario.",
      );
    }

    // Pertenencia: el profesional debe ser el titular del turno, o atender a este paciente (HU-25 / AGENTS.md)
    const isOwner = appointment.professionalId === ownProfessional.id;
    if (!isOwner) {
      const hasAttendedPatient = await prisma.appointment.count({
        where: {
          patientId: appointment.patientId,
          professionalId: ownProfessional.id,
        },
      });

      if (!hasAttendedPatient) {
        throw new DomainError(
          "FORBIDDEN",
          "No podés acceder a la atención médica de un paciente que no atendés.",
        );
      }
    }
  }

  if (!appointment.encounter) {
    return null;
  }

  const encounter = appointment.encounter;

  // Recepción y Gerencia no ven el contenido clínico (secreto médico, HU-25)
  if (actor.role !== Role.PROFESSIONAL) {
    return {
      id: encounter.id,
      appointmentId: encounter.appointmentId,
      hasEncounter: true,
      notes: null,
      indications: null,
      professional: {
        id: encounter.professional.id,
        firstName: encounter.professional.firstName,
        lastName: encounter.professional.lastName,
      },
      createdAt: encounter.createdAt,
      updatedAt: encounter.updatedAt,
      canEdit: false,
      editDeadline: encounterEditDeadline(appointment.startsAt),
    };
  }

  const isAuthor = ownProfessional?.id === encounter.professional.id;
  const deadline = encounterEditDeadline(appointment.startsAt);
  const canEdit = isAuthor && isEncounterEditable(appointment.startsAt);

  return {
    id: encounter.id,
    appointmentId: encounter.appointmentId,
    hasEncounter: true,
    notes: encounter.notes,
    indications: encounter.indications,
    professional: {
      id: encounter.professional.id,
      firstName: encounter.professional.firstName,
      lastName: encounter.professional.lastName,
    },
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
    canEdit,
    editDeadline: deadline,
  };
}
