import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import {
  AppointmentStatus,
  Role,
  type Weekday,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { STAFF_ROLES } from "@/lib/roles";
import { getTodayDateString } from "@/lib/utils";
import {
  WEEKDAY_LABEL,
  type AffectedAppointment,
  dateFromDb,
  dateToDb,
  formatInstant,
  formatMinute,
  toLocalSlot,
} from "@/lib/schedule";
import type {
  AvailabilityExceptionInput,
  AvailabilityWindowInput,
  HolidayInput,
  UpdateAvailabilityWindowInput,
} from "@/lib/validation/availability";

// Agenda de un profesional (HU-05): franjas del patrón semanal, excepciones y
// feriados. Fichas en docs/acciones.md.
//
// Las escrituras corren en una transacción `Serializable`: el control de turnos
// afectados lee los turnos y escribe la agenda, y no puede intercalarse con el
// alta de un turno (HU-09) que lea la agenda vieja.

type Tx = Prisma.TransactionClient;

const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};

const FORBIDDEN_MESSAGE = "No tenés permiso para realizar esta operación.";

/// Un `PROFESSIONAL` consulta solo su propia agenda (HU-05). Los demás roles
/// del centro ven la de cualquiera.
export function canViewSchedule(
  actor: Actor,
  professionalUserId: number | null,
): boolean {
  return actor.role !== Role.PROFESSIONAL || professionalUserId === actor.id;
}

// ─────────────────────── Turnos afectados ─────────────────────────────

type WindowShape = {
  id: number;
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
  serviceIds: number[];
};

const appointmentSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  serviceId: true,
  patient: { select: { firstName: true, lastName: true } },
  service: { select: { name: true } },
  professional: { select: { firstName: true, lastName: true } },
} satisfies Prisma.AppointmentSelect;

type ScheduledAppointment = Prisma.AppointmentGetPayload<{
  select: typeof appointmentSelect;
}>;

/// Horario local de un turno: día, minuto de inicio y de fin.
function localRange(appointment: ScheduledAppointment) {
  const slot = toLocalSlot(appointment.startsAt);
  const duration =
    (appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60_000;
  return { ...slot, endMinute: slot.minute + duration };
}

/// Si el turno entra completo en alguna franja que habilite su servicio. Una
/// franja sin servicios habilita todos los del profesional.
function fitsSomeWindow(
  appointment: ScheduledAppointment,
  windows: WindowShape[],
): boolean {
  const range = localRange(appointment);
  return windows.some(
    (window) =>
      window.weekday === range.weekday &&
      window.startMinute <= range.minute &&
      range.endMinute <= window.endMinute &&
      (window.serviceIds.length === 0 ||
        window.serviceIds.includes(appointment.serviceId)),
  );
}

function toAffected(appointment: ScheduledAppointment): AffectedAppointment {
  return {
    id: appointment.id,
    startsAt: appointment.startsAt.toISOString(),
    patientName: `${appointment.patient.lastName}, ${appointment.patient.firstName}`,
    serviceName: appointment.service.name,
    professionalName: `${appointment.professional.lastName}, ${appointment.professional.firstName}`,
  };
}

function rejectAffected(appointments: ScheduledAppointment[], cause: string) {
  if (appointments.length === 0) return;
  const detail = appointments
    .map(
      (appointment) =>
        `#${appointment.id} (${formatInstant(appointment.startsAt)})`,
    )
    .join(", ");
  throw new DomainError(
    "FUTURE_APPOINTMENTS",
    `${cause} ${appointments.length === 1 ? "el turno programado" : `${appointments.length} turnos programados`}: ${detail}. Cancelalos antes de continuar.`,
    undefined,
    { appointments: appointments.map(toAffected) },
  );
}

/// Turnos programados que todavía no comenzaron.
function futureScheduled(where: Prisma.AppointmentWhereInput) {
  return {
    where: {
      AND: [
        where,
        { status: AppointmentStatus.SCHEDULED, startsAt: { gt: new Date() } },
      ],
    },
    select: appointmentSelect,
    orderBy: { startsAt: "asc" },
  } satisfies Prisma.AppointmentFindManyArgs;
}

/// Turnos de un día local. Se consulta un rango holgado en UTC y se filtra
/// por la fecha en hora del centro.
async function scheduledOnDate(
  tx: Tx,
  date: string,
  where: Prisma.AppointmentWhereInput = {},
) {
  const day = dateToDb(date).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const appointments = await tx.appointment.findMany(
    futureScheduled({
      ...where,
      startsAt: { gte: new Date(day - oneDay), lt: new Date(day + 2 * oneDay) },
    }),
  );
  return appointments.filter(
    (appointment) => toLocalSlot(appointment.startsAt).date === date,
  );
}

/// Rechaza el cambio si algún turno que entraba en las franjas `before` deja
/// de entrar en `after` (HU-05: no se acorta ni se elimina una franja con
/// turnos adentro).
async function assertNoStrandedAppointments(
  tx: Tx,
  professionalId: number,
  before: WindowShape[],
  after: WindowShape[],
) {
  const appointments = await tx.appointment.findMany(
    futureScheduled({ professionalId }),
  );
  rejectAffected(
    appointments.filter(
      (appointment) =>
        fitsSomeWindow(appointment, before) &&
        !fitsSomeWindow(appointment, after),
    ),
    "El cambio deja fuera de horario",
  );
}

// ─────────────────────────── Franjas ───────────────────────────────────

async function loadWindows(tx: Tx, professionalId: number) {
  const windows = await tx.availabilityWindow.findMany({
    where: { professionalId },
    select: {
      id: true,
      weekday: true,
      startMinute: true,
      endMinute: true,
      services: { select: { id: true } },
    },
  });
  return windows.map(({ services, ...window }) => ({
    ...window,
    serviceIds: services.map((service) => service.id),
  }));
}

/// Profesional activo, servicios que presta, consultorio activo y sin
/// superposición con otra franja del mismo día.
async function assertValidWindow(
  tx: Tx,
  input: AvailabilityWindowInput,
  windows: WindowShape[],
  ownId?: number,
) {
  const professional = await tx.professional.findUnique({
    where: { id: input.professionalId },
    select: { active: true, services: { select: { id: true } } },
  });
  if (!professional)
    throw new DomainError("NOT_FOUND", "El profesional no existe.");
  if (!professional.active)
    throw new DomainError(
      "VALIDATION",
      "No se pueden cargar franjas de un profesional inactivo.",
    );

  const offered = new Set(professional.services.map((service) => service.id));
  if (input.serviceIds.some((id) => !offered.has(id)))
    throw new DomainError(
      "NOT_FOUND",
      "Algún servicio no lo presta este profesional.",
      { serviceIds: ["Elegí servicios que preste el profesional"] },
    );

  if (input.roomId !== null) {
    const room = await tx.room.findFirst({
      where: { id: input.roomId, active: true },
      select: { id: true },
    });
    if (!room)
      throw new DomainError(
        "NOT_FOUND",
        "El consultorio no existe o no está activo.",
        { roomId: ["Elegí un consultorio activo"] },
      );
  }

  const overlap = windows.find(
    (window) =>
      window.id !== ownId &&
      window.weekday === input.weekday &&
      window.startMinute < input.endMinute &&
      input.startMinute < window.endMinute,
  );
  if (overlap) throw overlapError(overlap);
}

function overlapError(
  window?: Pick<WindowShape, "weekday" | "startMinute" | "endMinute">,
) {
  const detail = window
    ? `: ${WEEKDAY_LABEL[window.weekday].toLowerCase()} de ${formatMinute(window.startMinute)} a ${formatMinute(window.endMinute)}`
    : "";
  return new DomainError(
    "AVAILABILITY_WINDOW_OVERLAP",
    `La franja se superpone con otra del mismo día${detail}.`,
    { startTime: ["Se superpone con otra franja"] },
  );
}

/// La restricción `AvailabilityWindow_no_overlap` de la base respalda el
/// control de la DAL ante escrituras concurrentes.
async function translateOverlap<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.message.includes("AvailabilityWindow_no_overlap")
    )
      throw overlapError();
    throw error;
  }
}

export async function createAvailabilityWindow(
  input: AvailabilityWindowInput,
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  return translateOverlap(() =>
    prisma.$transaction(async (tx) => {
      const windows = await loadWindows(tx, input.professionalId);
      await assertValidWindow(tx, input, windows);
      return tx.availabilityWindow.create({
        data: {
          professionalId: input.professionalId,
          weekday: input.weekday,
          startMinute: input.startMinute,
          endMinute: input.endMinute,
          roomId: input.roomId,
          services: { connect: input.serviceIds.map((id) => ({ id })) },
        },
        select: { id: true },
      });
    }, SERIALIZABLE),
  );
}

export async function updateAvailabilityWindow(
  input: UpdateAvailabilityWindowInput,
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  return translateOverlap(() =>
    prisma.$transaction(async (tx) => {
      const windows = await loadWindows(tx, input.professionalId);
      if (!windows.some((window) => window.id === input.id))
        throw new DomainError(
          "NOT_FOUND",
          "La franja no existe en la agenda de este profesional.",
        );
      await assertValidWindow(tx, input, windows, input.id);

      const after = windows.map((window) =>
        window.id === input.id
          ? {
              id: input.id,
              weekday: input.weekday,
              startMinute: input.startMinute,
              endMinute: input.endMinute,
              serviceIds: input.serviceIds,
            }
          : window,
      );
      await assertNoStrandedAppointments(
        tx,
        input.professionalId,
        windows,
        after,
      );

      return tx.availabilityWindow.update({
        where: { id: input.id },
        data: {
          weekday: input.weekday,
          startMinute: input.startMinute,
          endMinute: input.endMinute,
          roomId: input.roomId,
          services: { set: input.serviceIds.map((id) => ({ id })) },
        },
        select: { id: true },
      });
    }, SERIALIZABLE),
  );
}

export async function deleteAvailabilityWindow(
  input: { id: number; professionalId: number },
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  return prisma.$transaction(async (tx) => {
    const windows = await loadWindows(tx, input.professionalId);
    if (!windows.some((window) => window.id === input.id))
      throw new DomainError(
        "NOT_FOUND",
        "La franja no existe en la agenda de este profesional.",
      );

    await assertNoStrandedAppointments(
      tx,
      input.professionalId,
      windows,
      windows.filter((window) => window.id !== input.id),
    );

    await tx.availabilityWindow.delete({ where: { id: input.id } });
    return { id: input.id };
  }, SERIALIZABLE);
}

// ───────────────────────── Excepciones ─────────────────────────────────

function assertNotPast(date: string) {
  if (date < getTodayDateString())
    throw new DomainError("VALIDATION", "La fecha no puede ser pasada.", {
      date: ["La fecha no puede ser pasada"],
    });
}

export async function createAvailabilityException(
  input: AvailabilityExceptionInput,
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  assertNotPast(input.date);
  return prisma.$transaction(async (tx) => {
    const professional = await tx.professional.findUnique({
      where: { id: input.professionalId },
      select: { id: true },
    });
    if (!professional)
      throw new DomainError("NOT_FOUND", "El profesional no existe.");

    const appointments = await scheduledOnDate(tx, input.date, {
      professionalId: input.professionalId,
    });
    const { startMinute, endMinute } = input;
    rejectAffected(
      appointments.filter((appointment) => {
        if (startMinute === null || endMinute === null) return true;
        const range = localRange(appointment);
        return range.minute < endMinute && startMinute < range.endMinute;
      }),
      "La excepción se superpone con",
    );

    return tx.availabilityException.create({
      data: {
        professionalId: input.professionalId,
        date: dateToDb(input.date),
        startMinute,
        endMinute,
        reason: input.reason,
        createdById: actor.id,
      },
      select: { id: true },
    });
  }, SERIALIZABLE);
}

export async function deleteAvailabilityException(
  input: { id: number; professionalId: number },
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  const exception = await prisma.availabilityException.findUnique({
    where: { id: input.id },
    select: { professionalId: true },
  });
  if (exception?.professionalId !== input.professionalId)
    throw new DomainError(
      "NOT_FOUND",
      "La excepción no existe en la agenda de este profesional.",
    );
  await prisma.availabilityException.delete({ where: { id: input.id } });
  return { id: input.id };
}

// ─────────────────────────── Lectura ───────────────────────────────────

export async function getProfessionalSchedule(
  professionalId: number,
  actor: Actor,
) {
  assertRole(actor, ...STAFF_ROLES);

  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      active: true,
      userId: true,
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
      exceptions: {
        where: { date: { gte: dateToDb(getTodayDateString()) } },
        select: {
          id: true,
          date: true,
          startMinute: true,
          endMinute: true,
          reason: true,
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ date: "asc" }, { startMinute: "asc" }],
      },
    },
  });
  if (!professional)
    throw new DomainError("NOT_FOUND", "El profesional no existe.");
  if (!canViewSchedule(actor, professional.userId))
    throw new DomainError("FORBIDDEN", FORBIDDEN_MESSAGE);

  const rooms = await prisma.room.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return {
    professional: {
      id: professional.id,
      firstName: professional.firstName,
      lastName: professional.lastName,
      active: professional.active,
    },
    windows: professional.availabilityWindows,
    exceptions: professional.exceptions.map((exception) => ({
      ...exception,
      date: dateFromDb(exception.date),
    })),
    services: professional.services,
    rooms,
  };
}

/// Profesional vinculado al usuario de la sesión, para el acceso directo a sus
/// horarios de atención (`/my-schedule`).
export async function getOwnProfessionalId(actor: Actor) {
  assertRole(actor, Role.PROFESSIONAL);

  const professional = await prisma.professional.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!professional)
    throw new DomainError(
      "NOT_FOUND",
      "Tu usuario no está vinculado a ningún profesional.",
    );
  return professional.id;
}

// ─────────────────────────── Feriados ──────────────────────────────────

export async function listHolidays(actor: Actor) {
  assertRole(actor, ...STAFF_ROLES);
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: dateToDb(getTodayDateString()) } },
    select: { id: true, date: true, description: true },
    orderBy: { date: "asc" },
  });
  return holidays.map((holiday) => ({
    ...holiday,
    date: dateFromDb(holiday.date),
  }));
}

export async function createHoliday(input: HolidayInput, actor: Actor) {
  assertRole(actor, Role.MANAGER);
  assertNotPast(input.date);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.holiday.findUnique({
      where: { date: dateToDb(input.date) },
      select: { id: true },
    });
    if (existing)
      throw new DomainError("DUPLICATE", "Ya hay un feriado cargado ese día.", {
        date: ["Ya hay un feriado ese día"],
      });

    rejectAffected(
      await scheduledOnDate(tx, input.date),
      "El feriado cae sobre",
    );

    const holiday = await tx.holiday.create({
      data: { date: dateToDb(input.date), description: input.description },
      select: { id: true, date: true, description: true },
    });
    return { ...holiday, date: dateFromDb(holiday.date) };
  }, SERIALIZABLE);
}

export async function deleteHoliday(input: { id: number }, actor: Actor) {
  assertRole(actor, Role.MANAGER);
  const holiday = await prisma.holiday.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!holiday) throw new DomainError("NOT_FOUND", "El feriado no existe.");
  await prisma.holiday.delete({ where: { id: input.id } });
  return { id: input.id };
}
