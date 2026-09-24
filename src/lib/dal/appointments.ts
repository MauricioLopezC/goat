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
import {
  dateFromDb,
  dateToDb,
  getWeekDays,
  parseTime,
  toLocalSlot,
} from "@/lib/schedule";
import {
  appointmentDateSchema,
  appointmentOptionsSchema,
  availableSlotsSchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  professionalAgendaSchema,
  type AvailableSlotsInput,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type ProfessionalAgendaInput,
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
  events: {
    select: {
      id: true,
      type: true,
      reason: true,
      requestedBy: true,
      createdAt: true,
      user: { select: personSelect },
    },
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
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
  input: {
    query?: string;
    patientPage?: number;
    patientId?: number;
    serviceId?: number;
  },
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = appointmentOptionsSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los filtros de búsqueda.");
  const { query, patientPage, patientId, serviceId } = parsed.data;
  const [patientResults, patient, services, professionals] = await Promise.all([
    prisma.patient.findMany({
      where: {
        active: true,
        AND: query
          ? query.split(/\s+/).map((word) => ({
              OR: [
                {
                  firstName: {
                    contains: word,
                    mode: "insensitive" as const,
                  },
                },
                {
                  lastName: {
                    contains: word,
                    mode: "insensitive" as const,
                  },
                },
                {
                  documentNumber: {
                    contains: word,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }))
          : [],
      },
      select: patientSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (patientPage - 1) * 10,
      take: 11,
    }),
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
  return {
    patients: patientResults.slice(0, 10),
    hasMorePatients: patientResults.length > 10,
    patient,
    services,
    professionals,
  };
}

export async function listAvailableDates(
  input: Pick<
    AvailableSlotsInput,
    "patientId" | "serviceId" | "professionalId"
  >,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = availableSlotsSchema.omit({ date: true }).safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "VALIDATION",
      "Revisá los datos para consultar disponibilidad.",
    );
  const { patientId, serviceId, professionalId } = parsed.data;
  const now = new Date();
  const bounds = appointmentDateBounds(now);
  const rangeEnd = appointmentInstant(bounds.max, 1440);
  const rangeStart = appointmentInstant(bounds.min, 0);
  return prisma.$transaction(
    async (tx) => {
      const [
        patient,
        service,
        professional,
        windows,
        exceptions,
        holidays,
        appointments,
      ] = await Promise.all([
        tx.patient.findFirst({
          where: { id: patientId, active: true },
          select: { id: true },
        }),
        tx.service.findFirst({
          where: { id: serviceId, active: true },
          select: { durationMinutes: true },
        }),
        tx.professional.findFirst({
          where: {
            id: professionalId,
            active: true,
            services: { some: { id: serviceId } },
          },
          select: { id: true },
        }),
        tx.availabilityWindow.findMany({
          where: {
            professionalId,
            OR: [
              { services: { none: {} } },
              { services: { some: { id: serviceId } } },
            ],
          },
          select: { weekday: true, startMinute: true, endMinute: true },
        }),
        tx.availabilityException.findMany({
          where: {
            professionalId,
            date: { gte: dateToDb(bounds.min), lte: dateToDb(bounds.max) },
          },
          select: { date: true, startMinute: true, endMinute: true },
        }),
        tx.holiday.findMany({
          where: {
            date: { gte: dateToDb(bounds.min), lte: dateToDb(bounds.max) },
          },
          select: { date: true },
        }),
        tx.appointment.findMany({
          where: {
            status: { in: occupiedStatuses },
            startsAt: { lt: rangeEnd },
            endsAt: { gt: rangeStart },
            OR: [{ professionalId }, { patientId }],
          },
          select: { startsAt: true, endsAt: true },
        }),
      ]);
      if (!patient || !service || !professional)
        throw new DomainError(
          "NOT_FOUND",
          "El paciente, servicio o profesional ya no está disponible, o el profesional no presta ese servicio.",
        );
      const dates: string[] = [];
      const day = dateToDb(bounds.min);
      while (dateFromDb(day) <= bounds.max) {
        const date = dateFromDb(day);
        const weekday = toLocalSlot(appointmentInstant(date, 0)).weekday;
        if (
          calculateAvailableSlots({
            date,
            durationMinutes: service.durationMinutes,
            windows: windows.filter((window) => window.weekday === weekday),
            exceptions: exceptions.filter(
              (exception) => dateFromDb(exception.date) === date,
            ),
            holiday: holidays.some(
              (holiday) => dateFromDb(holiday.date) === date,
            ),
            appointments,
            now,
          }).length > 0
        )
          dates.push(date);
        day.setUTCDate(day.getUTCDate() + 1);
      }
      return dates;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
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

export async function getProfessionalAgenda(
  input: ProfessionalAgendaInput,
  actor: Actor,
) {
  assertRole(actor, Role.PROFESSIONAL, Role.MANAGER, Role.RECEPTIONIST);
  const parsed = professionalAgendaSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION",
      "Revisá los parámetros de consulta de la agenda.",
    );
  }
  const {
    date,
    view,
    hideCancelled,
    professionalId: requestedProfessionalId,
  } = parsed.data;

  let targetProfessionalId: number;
  if (actor.role === Role.PROFESSIONAL) {
    const own = await prisma.professional.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!own) {
      throw new DomainError(
        "NOT_FOUND",
        "No se encontró el perfil profesional vinculado a tu usuario.",
      );
    }
    if (
      requestedProfessionalId !== undefined &&
      requestedProfessionalId !== own.id
    ) {
      throw new DomainError(
        "FORBIDDEN",
        "No tenés permiso para ver la agenda de otro profesional.",
      );
    }
    targetProfessionalId = own.id;
  } else {
    if (!requestedProfessionalId) {
      throw new DomainError(
        "VALIDATION",
        "Tenés que indicar qué profesional querés consultar.",
      );
    }
    targetProfessionalId = requestedProfessionalId;
  }

  const professional = await prisma.professional.findUnique({
    where: { id: targetProfessionalId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      active: true,
      titles: { select: { name: true } },
      services: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      availabilityWindows: {
        select: {
          id: true,
          weekday: true,
          startMinute: true,
          endMinute: true,
          room: { select: { id: true, name: true } },
          services: { select: { id: true, name: true } },
        },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      },
    },
  });

  if (!professional) {
    throw new DomainError("NOT_FOUND", "El profesional no existe.");
  }

  const selectedDate = date ?? toLocalSlot(new Date()).date;
  const week = getWeekDays(selectedDate);

  const rangeStart =
    view === "week"
      ? appointmentInstant(week.monday, 0)
      : appointmentInstant(selectedDate, 0);
  const rangeEnd =
    view === "week"
      ? appointmentInstant(week.sunday, 1440)
      : appointmentInstant(selectedDate, 1440);

  const fromDateStr = view === "week" ? week.monday : selectedDate;
  const toDateStr = view === "week" ? week.sunday : selectedDate;

  const [appointments, holidays, exceptions] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        professionalId: professional.id,
        startsAt: {
          gte: rangeStart,
          lt: rangeEnd,
        },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        notes: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentType: true,
            documentNumber: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    }),
    prisma.holiday.findMany({
      where: {
        date: {
          gte: dateToDb(fromDateStr),
          lte: dateToDb(toDateStr),
        },
      },
      select: {
        id: true,
        date: true,
        description: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.availabilityException.findMany({
      where: {
        professionalId: professional.id,
        date: {
          gte: dateToDb(fromDateStr),
          lte: dateToDb(toDateStr),
        },
      },
      select: {
        id: true,
        date: true,
        startMinute: true,
        endMinute: true,
        reason: true,
      },
      orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    }),
  ]);

  const summary = {
    total: appointments.length,
    scheduled: appointments.filter(
      (a) => a.status === AppointmentStatus.SCHEDULED,
    ).length,
    completed: appointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length,
    cancelled: appointments.filter(
      (a) => a.status === AppointmentStatus.CANCELLED,
    ).length,
  };

  const displayedAppointments = hideCancelled
    ? appointments.filter((a) => a.status !== AppointmentStatus.CANCELLED)
    : appointments;

  return {
    professional: {
      id: professional.id,
      firstName: professional.firstName,
      lastName: professional.lastName,
      active: professional.active,
      titles: professional.titles.map((t) => t.name).join(", ") || null,
      services: professional.services,
    },
    date: selectedDate,
    view,
    hideCancelled,
    week,
    windows: professional.availabilityWindows,
    appointments: displayedAppointments,
    summary,
    holidays: holidays.map((h) => ({
      id: h.id,
      date: dateFromDb(h.date),
      description: h.description,
    })),
    exceptions: exceptions.map((e) => ({
      id: e.id,
      date: dateFromDb(e.date),
      startMinute: e.startMinute,
      endMinute: e.endMinute,
      reason: e.reason,
    })),
  };
}

export async function cancelAppointment(
  input: CancelAppointmentInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = cancelAppointmentSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los datos ingresados.");
  const data = parsed.data;
  return prisma.$transaction(
    async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: data.appointmentId },
        select: { id: true, status: true },
      });
      if (!appointment)
        throw new DomainError("NOT_FOUND", "El turno no existe.");
      if (appointment.status !== AppointmentStatus.SCHEDULED)
        throw new DomainError(
          "INVALID_STATUS_TRANSITION",
          "Solo se puede cancelar un turno en estado Programado.",
        );
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.CANCELLED },
      });
      await tx.appointmentEvent.create({
        data: {
          appointmentId: appointment.id,
          type: AppointmentEventType.CANCELLED,
          reason: data.reason,
          requestedBy: data.requestedBy,
          userId: actor.id,
        },
      });
      return { id: appointment.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
