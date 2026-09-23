import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import {
  AppointmentEventType,
  AppointmentStatus,
  Role,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

export async function cancelProfessionalAppointment(
  input: {
    appointmentId: number;
    professionalId: number;
    reason: string;
    requestedBy: string;
  },
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  return prisma.$transaction(
    async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: input.appointmentId },
        select: {
          id: true,
          professionalId: true,
          status: true,
          startsAt: true,
        },
      });
      if (!appointment || appointment.professionalId !== input.professionalId)
        throw new DomainError(
          "NOT_FOUND",
          "El turno no existe en la ficha de este profesional.",
        );
      if (
        appointment.status !== AppointmentStatus.SCHEDULED ||
        appointment.startsAt <= new Date()
      )
        throw new DomainError(
          "INVALID_STATUS_TRANSITION",
          "Solo se puede cancelar un turno programado que aún no comenzó.",
        );
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.CANCELLED },
      });
      await tx.appointmentEvent.create({
        data: {
          appointmentId: appointment.id,
          type: AppointmentEventType.CANCELLED,
          reason: input.reason,
          requestedBy: input.requestedBy,
          userId: actor.id,
        },
      });
      return { id: appointment.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
