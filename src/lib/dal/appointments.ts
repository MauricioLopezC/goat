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
import {
  appointmentDateBounds,
  appointmentInstant,
  calculateAvailableSlots,
  rangesOverlap,
} from "@/lib/appointment-slots";
import { dateToDb, parseTime, toLocalSlot } from "@/lib/schedule";
import {
  appointmentDateSchema,
  appointmentOptionsSchema,
  availableSlotsSchema,
  createAppointmentSchema,
  type AvailableSlotsInput,
  type CreateAppointmentInput,
} from "@/lib/validation/appointments";

const occupiedStatuses = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.COMPLETED,
];
const personSelect = { id: true, firstName: true, lastName: true } as const;
const patientSelect = {
  ...personSelect,
  documentType: true,
  documentNumber: true,
} as const;
const summarySelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  notes: true,
  createdAt: true,
  patient: { select: patientSelect },
  professional: { select: personSelect },
  service: { select: { id: true, name: true } },
  createdBy: { select: personSelect },
} satisfies Prisma.AppointmentSelect;

function validateDate(date: string, now = new Date()) {
  const bounds = appointmentDateBounds(now);
  if (
    !appointmentDateSchema.safeParse(date).success ||
    date < bounds.min ||
    date > bounds.max
  )
    throw new DomainError(
      "VALIDATION",
      "Elegí una fecha desde hoy hasta dos meses hacia adelante.",
      { date: ["La fecha está fuera del período permitido."] },
    );
}

export async function getAppointmentOptions(
  input: { query?: string; patientId?: number; serviceId?: number },
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = appointmentOptionsSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los filtros de búsqueda.");
  const { query, patientId, serviceId } = parsed.data;
  const [patients, patient, services, professionals] = await Promise.all([
    query
      ? prisma.patient.findMany({
          where: {
            active: true,
            AND: query.split(/\s+/).map((word) => ({
              OR: [
                {
                  firstName: { contains: word, mode: "insensitive" as const },
                },
                {
                  lastName: { contains: word, mode: "insensitive" as const },
                },
                {
                  documentNumber: {
                    contains: word,
                    mode: "insensitive" as const,
                  },
                },
              ],
            })),
          },
          select: patientSelect,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
          take: 30,
        })
      : [],
    patientId
      ? prisma.patient.findFirst({
          where: { id: patientId, active: true },
          select: patientSelect,
        })
      : null,
    prisma.service.findMany({
      where: { active: true },
      select: { id: true, name: true, durationMinutes: true },
      orderBy: { name: "asc" },
    }),
    serviceId
      ? prisma.professional.findMany({
          where: {
            active: true,
            services: { some: { id: serviceId, active: true } },
            availabilityWindows: {
              some: {
                OR: [
                  { services: { none: {} } },
                  { services: { some: { id: serviceId } } },
                ],
              },
            },
          },
          select: personSelect,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : [],
  ]);
  return { patients, patient, services, professionals };
}

// Se usa el mismo cálculo al leer y dentro de la transacción de alta.
async function loadAvailability(
  tx: Prisma.TransactionClient,
  input: AvailableSlotsInput,
  actor: Actor,
  now: Date,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  validateDate(input.date, now);
  const dayStart = appointmentInstant(input.date, 0);
  const dayEnd = appointmentInstant(input.date, 1440);
  const [
    patient,
    service,
    professional,
    windows,
    exceptions,
    holiday,
    appointments,
  ] = await Promise.all([
    tx.patient.findFirst({
      where: { id: input.patientId, active: true },
      select: { id: true },
    }),
    tx.service.findFirst({
      where: { id: input.serviceId, active: true },
      select: { durationMinutes: true },
    }),
    tx.professional.findFirst({
      where: {
        id: input.professionalId,
        active: true,
        services: { some: { id: input.serviceId } },
      },
      select: { id: true },
    }),
    tx.availabilityWindow.findMany({
      where: {
        professionalId: input.professionalId,
        weekday: toLocalSlot(dayStart).weekday,
        OR: [
          { services: { none: {} } },
          { services: { some: { id: input.serviceId } } },
        ],
      },
      select: { startMinute: true, endMinute: true },
    }),
    tx.availabilityException.findMany({
      where: {
        professionalId: input.professionalId,
        date: dateToDb(input.date),
      },
      select: { startMinute: true, endMinute: true },
    }),
    tx.holiday.findUnique({
      where: { date: dateToDb(input.date) },
      select: { id: true },
    }),
    tx.appointment.findMany({
      where: {
        status: { in: occupiedStatuses },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        OR: [
          { professionalId: input.professionalId },
          { patientId: input.patientId },
        ],
      },
      select: {
        patientId: true,
        professionalId: true,
        startsAt: true,
        endsAt: true,
      },
    }),
  ]);
  if (!patient || !service || !professional)
    throw new DomainError(
      "NOT_FOUND",
      "El paciente, servicio o profesional ya no está disponible, o el profesional no presta ese servicio.",
    );
  return {
    durationMinutes: service.durationMinutes,
    windows,
    exceptions,
    holiday: Boolean(holiday),
    appointments,
    date: input.date,
    now,
  };
}

export async function listAvailableSlots(
  input: AvailableSlotsInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = availableSlotsSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "VALIDATION",
      "Revisá los datos para consultar disponibilidad.",
    );
  return prisma.$transaction(
    async (tx) =>
      calculateAvailableSlots(
        await loadAvailability(tx, parsed.data, actor, new Date()),
      ),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

function overlapError(patient = false) {
  return new DomainError(
    patient ? "PATIENT_APPOINTMENT_OVERLAP" : "APPOINTMENT_OVERLAP",
    patient
      ? "El paciente ya tiene un turno en ese horario. Actualizamos los horarios disponibles."
      : "Ese horario acaba de ocuparse. Actualizamos la grilla; elegí otro horario.",
  );
}

export async function createAppointment(
  input: CreateAppointmentInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los datos del turno.");
  const data = parsed.data;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const now = new Date();
          const availability = await loadAvailability(tx, data, actor, now);
          const startsAt = appointmentInstant(
            data.date,
            parseTime(data.startTime),
          );
          const endsAt = new Date(
            startsAt.getTime() + availability.durationMinutes * 60_000,
          );
          if (startsAt <= now)
            throw new DomainError(
              "VALIDATION",
              "No se puede asignar un turno en el pasado.",
            );
          const overlaps = availability.appointments.filter((a) =>
            rangesOverlap(
              startsAt.getTime(),
              endsAt.getTime(),
              a.startsAt.getTime(),
              a.endsAt.getTime(),
            ),
          );
          if (overlaps.some((a) => a.professionalId === data.professionalId))
            throw overlapError();
          if (overlaps.some((a) => a.patientId === data.patientId))
            throw overlapError(true);
          if (
            !calculateAvailableSlots(availability).some(
              (slot) => slot.startTime === data.startTime,
            )
          )
            throw new DomainError(
              "OUTSIDE_AVAILABILITY_WINDOW",
              "El horario no está disponible dentro de las franjas habilitadas. Actualizamos la grilla.",
            );
          // La hora puede haber pasado durante las lecturas de la transacción.
          if (startsAt <= new Date())
            throw new DomainError(
              "VALIDATION",
              "El horario elegido ya pasó. Elegí otro.",
            );
          return tx.appointment.create({
            data: {
              patientId: data.patientId,
              serviceId: data.serviceId,
              professionalId: data.professionalId,
              startsAt,
              endsAt,
              status: AppointmentStatus.SCHEDULED,
              notes: data.notes || null,
              createdById: actor.id,
            },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.message.includes("Appointment_professional_no_overlap"))
          throw overlapError();
        if (error.message.includes("Appointment_patient_no_overlap"))
          throw overlapError(true);
        if (error.code === "P2034") {
          if (attempt < 3) continue;
          throw new DomainError(
            "VALIDATION",
            "La agenda cambió mientras confirmabas. Actualizamos los horarios; volvé a elegir.",
          );
        }
      }
      throw error;
    }
  }
  throw new Error("Unreachable appointment retry state");
}

export async function listAppointments(date: string, actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  if (!appointmentDateSchema.safeParse(date).success)
    throw new DomainError("VALIDATION", "Elegí una fecha válida.");
  return prisma.appointment.findMany({
    where: {
      startsAt: {
        gte: appointmentInstant(date, 0),
        lt: appointmentInstant(date, 1440),
      },
      ...(actor.role === Role.PROFESSIONAL
        ? { professional: { userId: actor.id } }
        : {}),
    },
    select: summarySelect,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
}

export async function getAppointment(id: number, actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new DomainError("NOT_FOUND", "El turno no existe.");
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      ...(actor.role === Role.PROFESSIONAL
        ? { professional: { userId: actor.id } }
        : {}),
    },
    select: summarySelect,
  });
  if (!appointment)
    throw new DomainError("NOT_FOUND", "El turno no existe o no tenés acceso.");
  return appointment;
}

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
