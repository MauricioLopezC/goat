import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { assertNoActivePayment } from "@/lib/dal/payments";
import { serializableTransaction } from "@/lib/dal/transactions";
import { paginate } from "@/lib/pagination";
import {
  AppointmentEventType,
  AppointmentPriority,
  AppointmentStatus,
  PaymentStatus,
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
  getMonthRange,
  getWeekDays,
  parseTime,
  toLocalSlot,
} from "@/lib/schedule";
import {
  appointmentDateSchema,
  appointmentOptionsSchema,
  appointmentStatusChangeSchema,
  availableSlotsSchema,
  calendarAppointmentsSchema,
  calendarAvailabilitySchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  earliestSlotsSchema,
  professionalAgendaSchema,
  rescheduleAppointmentSchema,
  updateAppointmentPrioritySchema,
  type AppointmentStatusChangeInput,
  type AvailableSlotsInput,
  type CalendarAppointmentsInput,
  type CalendarAvailabilityInput,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type EarliestSlotsInput,
  type ProfessionalAgendaInput,
  type RescheduleAppointmentInput,
  type UpdateAppointmentPriorityInput,
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
  priority: true,
  priorityReason: true,
  notes: true,
  createdAt: true,
  patient: { select: patientSelect },
  professional: { select: personSelect },
  service: { select: { id: true, name: true } },
  createdBy: { select: personSelect },
} satisfies Prisma.AppointmentSelect;

const appointmentDetailSelect = {
  ...summarySelect,
  events: {
    select: {
      id: true,
      type: true,
      reason: true,
      requestedBy: true,
      createdAt: true,
      user: { select: personSelect },
      previousStartsAt: true,
      previousEndsAt: true,
      previousProfessional: { select: personSelect },
      newStartsAt: true,
      newEndsAt: true,
      newProfessional: { select: personSelect },
      previousPriority: true,
      newPriority: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: 10,
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
          // La cobertura decide el aviso de la orden médica (HU-21).
          select: { ...patientSelect, coverageType: true },
        })
      : null,
    prisma.service.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        requiresReferral: true,
        specialty: { select: { id: true, name: true } },
      },
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
    "patientId" | "serviceId" | "professionalId" | "excludeAppointmentId"
  >,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  const parsed = availableSlotsSchema.omit({ date: true }).safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "VALIDATION",
      "Revisá los datos para consultar disponibilidad.",
    );
  const { patientId, serviceId, professionalId, excludeAppointmentId } =
    parsed.data;
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
            startDate: { gte: dateToDb(bounds.min), lte: dateToDb(bounds.max) },
          },
          select: { startDate: true, startMinute: true, endMinute: true },
        }),
        tx.holiday.findMany({
          where: {
            startDate: { gte: dateToDb(bounds.min), lte: dateToDb(bounds.max) },
          },
          select: { startDate: true },
        }),
        tx.appointment.findMany({
          where: {
            status: { in: occupiedStatuses },
            startsAt: { lt: rangeEnd },
            endsAt: { gt: rangeStart },
            OR: [{ professionalId }, { patientId }],
            ...(excludeAppointmentId
              ? { id: { not: excludeAppointmentId } }
              : {}),
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
              (exception) => dateFromDb(exception.startDate) === date,
            ),
            holiday: holidays.some(
              (holiday) => dateFromDb(holiday.startDate) === date,
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
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
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
        startDate: dateToDb(input.date),
      },
      select: { startMinute: true, endMinute: true },
    }),
    tx.holiday.findFirst({
      where: { startDate: dateToDb(input.date) },
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
        ...(input.excludeAppointmentId
          ? { id: { not: input.excludeAppointmentId } }
          : {}),
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
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
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

export type EarliestSlot = {
  date: string;
  startTime: string;
  endTime: string;
  professional: {
    id: number;
    firstName: string;
    lastName: string;
  };
};

export async function listEarliestSlots(
  input: EarliestSlotsInput,
  actor: Actor,
): Promise<EarliestSlot[]> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = earliestSlotsSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "VALIDATION",
      "Revisá los datos para consultar disponibilidad.",
    );
  const { serviceId, patientId, limit } = parsed.data;
  const now = new Date();
  const bounds = appointmentDateBounds(now);
  const rangeStart = appointmentInstant(bounds.min, 0);
  const rangeEnd = appointmentInstant(bounds.max, 1440);

  return prisma.$transaction(
    async (tx) => {
      const [patient, service, professionals, holidays] = await Promise.all([
        tx.patient.findFirst({
          where: { id: patientId, active: true },
          select: { id: true },
        }),
        tx.service.findFirst({
          where: { id: serviceId, active: true },
          select: { id: true, durationMinutes: true },
        }),
        tx.professional.findMany({
          where: {
            active: true,
            services: { some: { id: serviceId } },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            availabilityWindows: {
              where: {
                OR: [
                  { services: { none: {} } },
                  { services: { some: { id: serviceId } } },
                ],
              },
              select: { weekday: true, startMinute: true, endMinute: true },
            },
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
        tx.holiday.findMany({
          where: {
            startDate: {
              gte: dateToDb(bounds.min),
              lte: dateToDb(bounds.max),
            },
          },
          select: { startDate: true },
        }),
      ]);

      if (!patient || !service) {
        throw new DomainError(
          "NOT_FOUND",
          "El paciente o el servicio ya no está disponible.",
        );
      }

      const activeProviders = professionals.filter(
        (p) => p.availabilityWindows.length > 0,
      );
      if (activeProviders.length === 0) return [];

      const providerIds = activeProviders.map((p) => p.id);
      const [exceptions, appointments] = await Promise.all([
        tx.availabilityException.findMany({
          where: {
            professionalId: { in: providerIds },
            startDate: {
              gte: dateToDb(bounds.min),
              lte: dateToDb(bounds.max),
            },
          },
          select: {
            professionalId: true,
            startDate: true,
            startMinute: true,
            endMinute: true,
          },
        }),
        tx.appointment.findMany({
          where: {
            status: { in: occupiedStatuses },
            startsAt: { lt: rangeEnd },
            endsAt: { gt: rangeStart },
            OR: [{ professionalId: { in: providerIds } }, { patientId }],
          },
          select: {
            professionalId: true,
            patientId: true,
            startsAt: true,
            endsAt: true,
          },
        }),
      ]);

      const holidaySet = new Set(holidays.map((h) => dateFromDb(h.startDate)));
      const results: EarliestSlot[] = [];

      const currentDay = new Date(`${bounds.min}T00:00:00Z`);
      const lastDay = new Date(`${bounds.max}T00:00:00Z`);

      while (currentDay <= lastDay) {
        const dateStr = currentDay.toISOString().slice(0, 10);
        if (!holidaySet.has(dateStr)) {
          const dayStart = appointmentInstant(dateStr, 0);
          const dayEnd = appointmentInstant(dateStr, 1440);
          const dayWeekday = toLocalSlot(dayStart).weekday;

          for (const professional of activeProviders) {
            const windows = professional.availabilityWindows.filter(
              (w) => w.weekday === dayWeekday,
            );
            if (windows.length === 0) continue;

            const profExceptions = exceptions.filter(
              (e) =>
                e.professionalId === professional.id &&
                dateFromDb(e.startDate) === dateStr,
            );
            const profAppointments = appointments.filter(
              (a) =>
                (a.professionalId === professional.id ||
                  a.patientId === patientId) &&
                a.startsAt < dayEnd &&
                a.endsAt > dayStart,
            );

            const available = calculateAvailableSlots({
              date: dateStr,
              durationMinutes: service.durationMinutes,
              windows,
              exceptions: profExceptions,
              appointments: profAppointments,
              holiday: false,
              now,
            });

            for (const slot of available) {
              results.push({
                date: dateStr,
                startTime: slot.startTime,
                endTime: slot.endTime,
                professional: {
                  id: professional.id,
                  firstName: professional.firstName,
                  lastName: professional.lastName,
                },
              });
            }
          }
        }

        if (results.length >= limit) {
          break;
        }

        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }

      results.sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        const timeComp = a.startTime.localeCompare(b.startTime);
        if (timeComp !== 0) return timeComp;
        const nameComp = a.professional.lastName.localeCompare(
          b.professional.lastName,
        );
        if (nameComp !== 0) return nameComp;
        return a.professional.firstName.localeCompare(b.professional.firstName);
      });

      return results.slice(0, limit);
    },
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
              priority:
                (data.priority as AppointmentPriority) ??
                AppointmentPriority.NORMAL,
              priorityReason:
                data.priority === "URGENT"
                  ? (data.priorityReason ?? null)
                  : null,
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

export async function listAppointments(
  input: CalendarAppointmentsInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  const parsed = calendarAppointmentsSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Elegí un rango de fechas válido.");
  const { from, to, professionalId, serviceId, hideCancelled } = parsed.data;
  let professionalWhere: Prisma.AppointmentWhereInput = professionalId
    ? { professionalId }
    : {};
  if (actor.role === Role.PROFESSIONAL) {
    // Pertenencia: el profesional solo ve su propia agenda.
    const own = await prisma.professional.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!own || (professionalId !== undefined && professionalId !== own.id))
      throw new DomainError(
        "FORBIDDEN",
        "No tenés permiso para ver la agenda de otro profesional.",
      );
    professionalWhere = { professionalId: own.id };
  }
  return prisma.appointment.findMany({
    where: {
      startsAt: {
        gte: appointmentInstant(from, 0),
        lt: appointmentInstant(to, 1440),
      },
      ...professionalWhere,
      ...(serviceId ? { serviceId } : {}),
      ...(hideCancelled
        ? { status: { not: AppointmentStatus.CANCELLED } }
        : {}),
    },
    select: summarySelect,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
}

/// Datos para calcular los bloques libres del calendario del centro (HU-11).
/// El cálculo lo hace `calculateFreeBlocks`, fuera de la DAL.
export async function listAvailabilityWindows(
  input: CalendarAvailabilityInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = calendarAvailabilitySchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Elegí un rango de fechas válido.");
  const { from, to, professionalId, serviceId } = parsed.data;
  const service = serviceId
    ? await prisma.service.findFirst({
        where: { id: serviceId, active: true },
        select: { durationMinutes: true },
      })
    : null;
  if (serviceId && !service)
    throw new DomainError(
      "NOT_FOUND",
      "El servicio no existe o está inactivo.",
    );
  const dateRange = { gte: dateToDb(from), lte: dateToDb(to) };
  const [professionals, holidays] = await Promise.all([
    prisma.professional.findMany({
      where: {
        active: true,
        ...(professionalId ? { id: professionalId } : {}),
        ...(serviceId ? { services: { some: { id: serviceId } } } : {}),
      },
      select: {
        ...personSelect,
        availabilityWindows: {
          where: serviceId
            ? {
                OR: [
                  { services: { none: {} } },
                  { services: { some: { id: serviceId } } },
                ],
              }
            : undefined,
          select: { weekday: true, startMinute: true, endMinute: true },
          orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
        },
        exceptions: {
          where: { startDate: dateRange },
          select: {
            id: true,
            startDate: true,
            startMinute: true,
            endMinute: true,
            reason: true,
          },
          orderBy: [{ startDate: "asc" }, { startMinute: "asc" }],
        },
        // Turnos que ocupan, de cualquier servicio: el filtro de servicio del
        // calendario no debe hacer aparecer libre un horario tomado.
        appointments: {
          where: {
            status: { in: occupiedStatuses },
            startsAt: { lt: appointmentInstant(to, 1440) },
            endsAt: { gt: appointmentInstant(from, 0) },
          },
          select: { startsAt: true, endsAt: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    }),
    prisma.holiday.findMany({
      where: { startDate: dateRange },
      select: { id: true, startDate: true, description: true },
      orderBy: { startDate: "asc" },
    }),
  ]);
  return {
    professionals: professionals.map(
      ({ availabilityWindows, exceptions, appointments, ...professional }) => ({
        ...professional,
        windows: availabilityWindows,
        exceptions: exceptions.map((exception) => ({
          ...exception,
          date: dateFromDb(exception.startDate),
        })),
        busy: appointments,
      }),
    ),
    holidays: holidays.map((holiday) => ({
      // El id permite quitar el cierre desde el calendario (HU-14).
      id: holiday.id,
      date: dateFromDb(holiday.startDate),
      description: holiday.description,
    })),
    serviceDurationMinutes: service?.durationMinutes,
  };
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
    select: appointmentDetailSelect,
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
  return serializableTransaction(async (tx) => {
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
    await assertNoActivePayment(tx, appointment.id, "cancelarlo");
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
  });
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
  const month = getMonthRange(selectedDate);

  let fromDateStr = selectedDate;
  let toDateStr = selectedDate;
  if (view === "week") {
    fromDateStr = week.monday;
    toDateStr = week.sunday;
  } else if (view === "month") {
    fromDateStr = month.from;
    toDateStr = month.to;
  }

  const rangeStart = appointmentInstant(fromDateStr, 0);
  const rangeEnd = appointmentInstant(toDateStr, 1440);

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
        priority: true,
        priorityReason: true,
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
        startDate: {
          gte: dateToDb(fromDateStr),
          lte: dateToDb(toDateStr),
        },
      },
      select: {
        id: true,
        startDate: true,
        description: true,
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.availabilityException.findMany({
      where: {
        professionalId: professional.id,
        startDate: {
          gte: dateToDb(fromDateStr),
          lte: dateToDb(toDateStr),
        },
      },
      select: {
        id: true,
        startDate: true,
        startMinute: true,
        endMinute: true,
        reason: true,
      },
      orderBy: [{ startDate: "asc" }, { startMinute: "asc" }],
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
    month,
    windows: professional.availabilityWindows,
    appointments: displayedAppointments,
    summary,
    holidays: holidays.map((h) => ({
      id: h.id,
      date: dateFromDb(h.startDate),
      description: h.description,
    })),
    exceptions: exceptions.map((e) => ({
      id: e.id,
      date: dateFromDb(e.startDate),
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
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  const parsed = cancelAppointmentSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los datos ingresados.");
  const data = parsed.data;
  if (!data.reason || data.reason.trim().length === 0) {
    throw new DomainError(
      "REASON_REQUIRED",
      "El motivo de cancelación es obligatorio.",
    );
  }
  return serializableTransaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: data.appointmentId },
      select: {
        id: true,
        status: true,
        professional: { select: { userId: true } },
      },
    });
    if (!appointment) throw new DomainError("NOT_FOUND", "El turno no existe.");
    if (
      actor.role === Role.PROFESSIONAL &&
      appointment.professional.userId !== actor.id
    ) {
      throw new DomainError(
        "FORBIDDEN",
        "Solo podés cancelar tus propios turnos.",
      );
    }
    if (appointment.status !== AppointmentStatus.SCHEDULED)
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        "Solo se puede cancelar un turno en estado Programado.",
      );
    await assertNoActivePayment(tx, appointment.id, "cancelarlo");
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
  });
}

export async function rescheduleAppointment(
  input: RescheduleAppointmentInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  const parsed = rescheduleAppointmentSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los datos ingresados.");
  const data = parsed.data;
  if (!data.reason || data.reason.trim().length === 0) {
    throw new DomainError(
      "REASON_REQUIRED",
      "El motivo de reprogramación es obligatorio.",
    );
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const now = new Date();
          const appointment = await tx.appointment.findUnique({
            where: { id: data.appointmentId },
            select: {
              id: true,
              patientId: true,
              serviceId: true,
              professionalId: true,
              startsAt: true,
              endsAt: true,
              status: true,
              professional: { select: { userId: true } },
            },
          });
          if (!appointment)
            throw new DomainError("NOT_FOUND", "El turno no existe.");
          if (
            actor.role === Role.PROFESSIONAL &&
            appointment.professional.userId !== actor.id
          ) {
            throw new DomainError(
              "FORBIDDEN",
              "Solo podés reprogramar tus propios turnos.",
            );
          }
          if (appointment.status !== AppointmentStatus.SCHEDULED)
            throw new DomainError(
              "INVALID_STATUS_TRANSITION",
              "Solo se puede reprogramar un turno en estado Programado.",
            );
          if (appointment.startsAt <= now)
            throw new DomainError(
              "INVALID_STATUS_TRANSITION",
              "Solo se puede reprogramar un turno programado que aún no comenzó.",
            );

          const targetProfessionalId =
            data.newProfessionalId ?? appointment.professionalId;

          const availability = await loadAvailability(
            tx,
            {
              patientId: appointment.patientId,
              serviceId: appointment.serviceId,
              professionalId: targetProfessionalId,
              date: data.date,
              excludeAppointmentId: appointment.id,
            },
            actor,
            now,
          );

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
          if (overlaps.some((a) => a.professionalId === targetProfessionalId))
            throw overlapError();
          if (overlaps.some((a) => a.patientId === appointment.patientId))
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

          if (startsAt <= new Date())
            throw new DomainError(
              "VALIDATION",
              "El horario elegido ya pasó. Elegí otro.",
            );

          if (
            targetProfessionalId === appointment.professionalId &&
            startsAt.getTime() === appointment.startsAt.getTime()
          ) {
            throw new DomainError(
              "VALIDATION",
              "El nuevo horario o profesional debe ser diferente al actual.",
            );
          }

          await tx.appointment.update({
            where: { id: appointment.id },
            data: {
              professionalId: targetProfessionalId,
              startsAt,
              endsAt,
            },
          });

          await tx.appointmentEvent.create({
            data: {
              appointmentId: appointment.id,
              type: AppointmentEventType.RESCHEDULED,
              reason: data.reason,
              requestedBy: data.requestedBy,
              previousStartsAt: appointment.startsAt,
              previousEndsAt: appointment.endsAt,
              previousProfessionalId: appointment.professionalId,
              newStartsAt: startsAt,
              newEndsAt: endsAt,
              newProfessionalId: targetProfessionalId,
              userId: actor.id,
            },
          });

          return { id: appointment.id };
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

/// Completar o marcar Vencido un turno Programado (HU-11). La condición de
/// estado y de tiempo va en el mismo `UPDATE`: si otro usuario cambió el turno
/// antes, la fila ya no coincide y no se pisa su cambio. Quien la llama ya
/// verificó el rol.
async function closeAppointment(
  input: AppointmentStatusChangeInput,
  target: typeof AppointmentStatus.COMPLETED | typeof AppointmentStatus.EXPIRED,
  actor: Actor,
) {
  const parsed = appointmentStatusChangeSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los datos ingresados.");
  const { appointmentId, reason } = parsed.data;
  const completing = target === AppointmentStatus.COMPLETED;
  // Serializable: vencer compite con cobrar (HU-21); si los dos llegan a la
  // vez, uno se reintenta y ve el estado del otro.
  return serializableTransaction(async (tx) => {
    if (!completing)
      await assertNoActivePayment(tx, appointmentId, "marcarlo como vencido");
    const now = new Date();
    const { count } = await tx.appointment.updateMany({
      where: {
        id: appointmentId,
        status: AppointmentStatus.SCHEDULED,
        ...(completing ? { startsAt: { lte: now } } : { endsAt: { lte: now } }),
        ...(actor.role === Role.PROFESSIONAL
          ? { professional: { userId: actor.id } }
          : {}),
      },
      data: { status: target },
    });
    if (count === 0) {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          status: true,
          professional: { select: { userId: true } },
        },
      });
      if (!appointment)
        throw new DomainError("NOT_FOUND", "El turno no existe.");
      if (
        actor.role === Role.PROFESSIONAL &&
        appointment.professional.userId !== actor.id
      ) {
        throw new DomainError(
          "FORBIDDEN",
          completing
            ? "Solo podés completar tus propios turnos."
            : "Solo podés marcar como vencidos tus propios turnos.",
        );
      }
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        appointment.status !== AppointmentStatus.SCHEDULED
          ? "Solo se puede cambiar el estado de un turno Programado."
          : completing
            ? "Solo se puede marcar Completado un turno que ya comenzó."
            : "Solo se puede marcar Vencido un turno que ya terminó.",
      );
    }
    await tx.appointmentEvent.create({
      data: {
        appointmentId,
        type: completing
          ? AppointmentEventType.COMPLETED
          : AppointmentEventType.EXPIRED,
        reason: reason || null,
        userId: actor.id,
      },
    });
    return { id: appointmentId };
  });
}

export async function completeAppointment(
  input: AppointmentStatusChangeInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  return closeAppointment(input, AppointmentStatus.COMPLETED, actor);
}

export async function expireAppointment(
  input: AppointmentStatusChangeInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  return closeAppointment(input, AppointmentStatus.EXPIRED, actor);
}

export async function updateAppointmentPriority(
  input: UpdateAppointmentPriorityInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = updateAppointmentPrioritySchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "VALIDATION",
      "Revisá los datos para cambiar la prioridad.",
    );
  const { appointmentId, priority, reason } = parsed.data;

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, status: true, priority: true },
    });
    if (!appointment)
      throw new DomainError("NOT_FOUND", "No se encontró el turno.");
    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        "Solo se puede cambiar la prioridad de turnos programados.",
      );
    }
    if (appointment.priority === priority) {
      throw new DomainError("VALIDATION", "El turno ya tiene esa prioridad.");
    }

    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        priority: priority as AppointmentPriority,
        priorityReason: priority === "URGENT" ? (reason ?? null) : null,
      },
      select: { id: true, priority: true },
    });

    await tx.appointmentEvent.create({
      data: {
        appointmentId,
        type: AppointmentEventType.PRIORITY_CHANGED,
        previousPriority: appointment.priority,
        newPriority: priority as AppointmentPriority,
        reason: reason || null,
        userId: actor.id,
      },
    });

    return updated;
  });
}

/// Turno sin cerrar (`UnclosedAppointment`, HU-22): Programado y ya terminado.
function unclosedWhere(now: Date) {
  return {
    status: AppointmentStatus.SCHEDULED,
    endsAt: { lte: now },
  } satisfies Prisma.AppointmentWhereInput;
}

/// Turnos pasados que siguen Programados, del más viejo al más nuevo, para
/// cerrarlos desde la lista (HU-22).
export async function listUnclosedAppointments(page: number, actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const where = unclosedWhere(new Date());
  const result = await paginate(
    page,
    () => prisma.appointment.count({ where }),
    (range) =>
      prisma.appointment.findMany({
        where,
        orderBy: [{ endsAt: "asc" }, { id: "asc" }],
        ...range,
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          patient: { select: patientSelect },
          professional: { select: personSelect },
          service: { select: { id: true, name: true } },
          payments: {
            where: { status: PaymentStatus.PAID },
            select: { id: true },
          },
        },
      }),
  );
  return {
    ...result,
    items: result.items.map(({ payments, ...appointment }) => ({
      ...appointment,
      hasActivePayment: payments.length > 0,
    })),
  };
}

/// Cantidad de turnos sin cerrar, para el acceso desde el calendario (HU-22).
export async function countUnclosedAppointments(actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  return prisma.appointment.count({ where: unclosedWhere(new Date()) });
}
