import { PrismaClient } from "../src/generated/prisma/client";
import {
  AppointmentEventType,
  AppointmentStatus,
  PaymentStatus,
} from "../src/generated/prisma/enums";
import { appointmentInstant } from "../src/lib/appointment-slots";
import { addDays, dateToDb, toLocalSlot } from "../src/lib/schedule";
import { HISTORY_DEMAND, PATIENTS } from "./seed-data";

type Ids = Map<string, number>;
type Slot = {
  professionalId: number;
  patientId: number;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
};

const DAY_MS = 24 * 60 * 60_000;
const RECEPTION_EMAIL = "mesa@goat.local";
const SECOND_RECEPTION_EMAIL = "mesa2@goat.local";
const NOTES = [
  "Control de evolución. Refiere menos dolor y mejora de la movilidad.",
  "Evaluación realizada. Persiste molestia al esfuerzo, sin cambios de alarma.",
  "Buena evolución desde la visita anterior. Se revisó el plan de tratamiento.",
  "Consulta de seguimiento. Se conversaron síntomas y respuesta al tratamiento.",
];
const INDICATIONS = [
  "Continuar los ejercicios indicados y volver a control en dos semanas.",
  "Reposo relativo por 48 horas y control si el dolor aumenta.",
  "Mantener el plan de rehabilitación y reevaluar la movilidad.",
];

function hash(value: string): number {
  let result = 0;
  for (const character of value) {
    result = (result * 31 + character.charCodeAt(0)) >>> 0;
  }
  return result;
}

function overlaps(
  start: Date,
  end: Date,
  other: { startsAt: Date; endsAt: Date },
) {
  return start < other.endsAt && other.startsAt < end;
}

function occupied(slots: Slot[], candidate: Slot) {
  const occupies = (status: AppointmentStatus) =>
    status === AppointmentStatus.SCHEDULED ||
    status === AppointmentStatus.COMPLETED;
  return slots.some(
    (slot) =>
      (slot.professionalId === candidate.professionalId &&
        slot.startsAt.getTime() === candidate.startsAt.getTime()) ||
      (occupies(candidate.status) &&
        occupies(slot.status) &&
        (slot.professionalId === candidate.professionalId ||
          slot.patientId === candidate.patientId) &&
        overlaps(candidate.startsAt, candidate.endsAt, slot)),
  );
}

function eventType(status: AppointmentStatus) {
  return {
    [AppointmentStatus.SCHEDULED]: null,
    [AppointmentStatus.COMPLETED]: AppointmentEventType.COMPLETED,
    [AppointmentStatus.EXPIRED]: AppointmentEventType.EXPIRED,
    [AppointmentStatus.CANCELLED]: AppointmentEventType.CANCELLED,
  }[status];
}

export async function seedDemoHistory(
  prisma: PrismaClient,
  userIds: Ids,
  patientIds: Ids,
) {
  const now = new Date();
  const today = toLocalSlot(now).date;
  const firstDate = addDays(today, -92);
  const firstInstant = appointmentInstant(firstDate, 0);
  const lastInstant = appointmentInstant(addDays(today, 1), 0);
  const [professionals, holidays, exceptions, existing, closings, methods] =
    await Promise.all([
      prisma.professional.findMany({
        where: { licenseNumber: { in: Object.keys(HISTORY_DEMAND) } },
        select: {
          id: true,
          licenseNumber: true,
          userId: true,
          services: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              price: true,
            },
          },
          availabilityWindows: {
            select: {
              weekday: true,
              startMinute: true,
              endMinute: true,
              services: { select: { id: true } },
            },
          },
        },
      }),
      prisma.holiday.findMany({
        where: {
          startDate: { lte: dateToDb(today) },
          endDate: { gte: dateToDb(firstDate) },
        },
        select: {
          startDate: true,
          endDate: true,
          startMinute: true,
          endMinute: true,
        },
      }),
      prisma.availabilityException.findMany({
        where: {
          startDate: { lte: dateToDb(today) },
          endDate: { gte: dateToDb(firstDate) },
        },
        select: {
          professionalId: true,
          startDate: true,
          endDate: true,
          startMinute: true,
          endMinute: true,
        },
      }),
      prisma.appointment.findMany({
        where: { startsAt: { gte: firstInstant, lt: lastInstant } },
        select: {
          professionalId: true,
          patientId: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      }),
      prisma.cashClosing.findMany({
        where: { date: { gte: dateToDb(firstDate), lte: dateToDb(today) } },
        select: { date: true },
      }),
      prisma.paymentMethod.findMany({
        where: {
          name: { in: ["Efectivo", "Tarjeta de débito", "Transferencia"] },
        },
        select: { id: true, name: true },
      }),
    ]);

  const slots: Slot[] = existing;
  const closedDates = new Set(
    closings.map((closing) => closing.date.toISOString().slice(0, 10)),
  );
  const patientPool = PATIENTS.map((patient) => ({
    id: patientIds.get(patient.documentNumber),
    private: patient.coverage === null,
  })).filter(
    (patient): patient is { id: number; private: boolean } =>
      patient.id !== undefined,
  );
  const frequentPatients = patientPool.slice(0, 6);
  const receptionId = userIds.get(RECEPTION_EMAIL);
  const secondReceptionId = userIds.get(SECOND_RECEPTION_EMAIL);
  if (!receptionId || !secondReceptionId || patientPool.length === 0) {
    throw new Error("Faltan usuarios o pacientes para el seed de demo.");
  }
  const receptionUserId: number = receptionId;
  const secondReceptionUserId: number = secondReceptionId;

  const result = {
    appointments: 0,
    payments: 0,
    encounters: 0,
    closings: 0,
    today: 0,
  };

  async function addAppointment(
    date: string,
    professional: (typeof professionals)[number],
    window: (typeof professionals)[number]["availabilityWindows"][number],
    minute: number,
    status: AppointmentStatus,
    key: string,
    isToday: boolean,
  ) {
    const allowed = window.services.length
      ? professional.services.filter((service) =>
          window.services.some((item) => item.id === service.id),
        )
      : professional.services;
    const favored = allowed.filter((service) =>
      professional.licenseNumber === "8120" ||
      professional.licenseNumber === "7985" ||
      professional.licenseNumber === "9054"
        ? service.name === "Sesión de kinesiología motora" ||
          service.name === "Evaluación kinesiológica inicial"
        : service.name === "Consulta traumatológica general" ||
          service.name === "Consulta de rodilla" ||
          service.name === "Consulta de columna",
    );
    const choices =
      hash(key) % 4 === 0 || favored.length === 0 ? allowed : favored;
    const service = choices[hash(`${key}:service`) % choices.length];
    if (!service || minute + service.durationMinutes > window.endMinute)
      return false;
    const startsAt = appointmentInstant(date, minute);
    const endsAt = new Date(
      startsAt.getTime() + service.durationMinutes * 60_000,
    );
    if (status === AppointmentStatus.COMPLETED && startsAt > now) return false;
    if (status === AppointmentStatus.EXPIRED && endsAt > now) return false;
    const day = dateToDb(date);
    const unavailable = [
      ...holidays,
      ...exceptions.filter((item) => item.professionalId === professional.id),
    ].some(
      (item) =>
        item.startDate <= day &&
        item.endDate >= day &&
        (item.startMinute === null ||
          item.endMinute === null ||
          (item.startMinute < minute + service.durationMinutes &&
            minute < item.endMinute)),
    );
    if (unavailable) return false;

    let patient = patientPool[hash(`${key}:patient`) % patientPool.length];
    if (hash(key) % 3 === 0) {
      patient =
        frequentPatients[hash(`${key}:frequent`) % frequentPatients.length];
    }
    let candidate: Slot = {
      professionalId: professional.id,
      patientId: patient.id,
      startsAt,
      endsAt,
      status,
    };
    for (
      let attempt = 0;
      attempt < patientPool.length && occupied(slots, candidate);
      attempt++
    ) {
      if (
        slots.some(
          (slot) =>
            slot.professionalId === professional.id &&
            slot.startsAt.getTime() === startsAt.getTime(),
        )
      )
        return false;
      patient =
        patientPool[
          (hash(`${key}:patient`) + attempt + 1) % patientPool.length
        ];
      candidate = { ...candidate, patientId: patient.id };
    }
    if (occupied(slots, candidate)) return false;

    const createdById =
      hash(`${key}:user`) % 2 ? receptionUserId : secondReceptionUserId;
    const createdAt = new Date(
      Math.min(
        startsAt.getTime() - (3 + (hash(key) % 12)) * DAY_MS,
        now.getTime(),
      ),
    );
    const changedAt =
      status === AppointmentStatus.CANCELLED
        ? new Date(Math.min(startsAt.getTime() - DAY_MS, now.getTime()))
        : new Date(Math.min(endsAt.getTime(), now.getTime()));
    const paid =
      status === AppointmentStatus.COMPLETED &&
      patient.private &&
      service.price !== null &&
      hash(`${key}:paid`) % 5 !== 0;
    const method = methods[hash(`${key}:method`) % methods.length];
    if (paid && !method)
      throw new Error("Faltan medios de pago para el seed de demo.");
    const encounter =
      status === AppointmentStatus.COMPLETED &&
      professional.userId !== null &&
      hash(`${key}:encounter`) % 4 !== 0;
    await prisma.appointment.create({
      data: {
        professionalId: professional.id,
        patientId: patient.id,
        serviceId: service.id,
        startsAt,
        endsAt,
        status,
        createdById,
        createdAt,
        updatedAt:
          status === AppointmentStatus.SCHEDULED ? createdAt : changedAt,
        events: eventType(status)
          ? {
              create: {
                type: eventType(status)!,
                reason:
                  status === AppointmentStatus.CANCELLED
                    ? "El paciente avisó que no podía asistir."
                    : status === AppointmentStatus.EXPIRED
                      ? "El paciente no se presentó."
                      : null,
                requestedBy:
                  status === AppointmentStatus.CANCELLED ? "Paciente" : null,
                userId: createdById,
                createdAt: changedAt,
              },
            }
          : undefined,
        payments: paid
          ? {
              create: {
                paymentMethodId: method.id,
                amount: service.price!,
                createdById,
                createdAt: startsAt,
              },
            }
          : undefined,
        encounter: encounter
          ? {
              create: {
                professionalId: professional.id,
                notes: NOTES[hash(`${key}:notes`) % NOTES.length],
                indications:
                  INDICATIONS[hash(`${key}:indications`) % INDICATIONS.length],
                createdAt: changedAt,
                updatedAt: changedAt,
              },
            }
          : undefined,
      },
    });
    slots.push(candidate);
    result.appointments++;
    if (paid) result.payments++;
    if (encounter) result.encounters++;
    if (isToday) result.today++;
    return true;
  }

  // Tres meses móviles, sin alterar un día que el usuario ya cerró en la UI.
  for (let daysAgo = 92; daysAgo >= 1; daysAgo--) {
    const date = addDays(today, -daysAgo);
    if (closedDates.has(date)) continue;
    const weekday = toLocalSlot(appointmentInstant(date, 12 * 60)).weekday;
    for (const professional of professionals) {
      const demand = HISTORY_DEMAND[professional.licenseNumber];
      if (hash(`${date}:${professional.licenseNumber}:open`) % 5 === 0)
        continue;
      const windows = professional.availabilityWindows.filter(
        (window) => window.weekday === weekday,
      );
      let considered = 0;
      for (const window of windows) {
        for (
          let minute = window.startMinute;
          minute + 30 <= window.endMinute && considered < demand;
          minute += 60
        ) {
          const key = `${date}:${professional.licenseNumber}:${minute}`;
          considered++;
          const roll = hash(`${key}:status`) % 20;
          const status =
            roll < 3
              ? AppointmentStatus.CANCELLED
              : roll < 5
                ? AppointmentStatus.EXPIRED
                : AppointmentStatus.COMPLETED;
          await addAppointment(
            date,
            professional,
            window,
            minute,
            status,
            key,
            false,
          );
        }
      }
    }
  }

  // Un día actual listo para recorrer los cuatro estados en la demo. Si el
  // centro está cerrado o aún no llegó ningún turno, se agregan los posibles.
  const todayWeekday = toLocalSlot(now).weekday;
  const todayStatuses = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.EXPIRED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.SCHEDULED,
  ];
  for (const status of todayStatuses) {
    if (
      slots.some(
        (slot) =>
          toLocalSlot(slot.startsAt).date === today && slot.status === status,
      )
    )
      continue;
    let added = false;
    for (const professional of professionals) {
      if (added) break;
      for (const window of professional.availabilityWindows.filter(
        (item) => item.weekday === todayWeekday,
      )) {
        for (
          let minute = window.startMinute;
          minute + 30 <= window.endMinute;
          minute += 30
        ) {
          if (
            await addAppointment(
              today,
              professional,
              window,
              minute,
              status,
              `${today}:${professional.licenseNumber}:${minute}:today`,
              true,
            )
          ) {
            added = true;
            break;
          }
        }
        if (added) break;
      }
    }
  }

  // La caja fotografía todos los cobros del día, incluidos los cargados desde
  // la interfaz. Una segunda corrida no modifica cajas existentes.
  for (let daysAgo = 92; daysAgo >= 1; daysAgo--) {
    const date = addDays(today, -daysAgo);
    if (closedDates.has(date)) continue;
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: appointmentInstant(date, 0),
          lt: appointmentInstant(addDays(date, 1), 0),
        },
        cashClosingId: null,
      },
      select: {
        id: true,
        amount: true,
        status: true,
        paymentMethod: { select: { name: true } },
      },
    });
    if (payments.length === 0) continue;
    const paid = payments.filter(
      (payment) => payment.status === PaymentStatus.PAID,
    );
    const totalAmount = paid.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const expectedCashAmount = paid
      .filter((payment) => payment.paymentMethod.name === "Efectivo")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    await prisma.$transaction(async (tx) => {
      const closing = await tx.cashClosing.create({
        data: {
          date: dateToDb(date),
          paymentCount: paid.length,
          totalAmount,
          expectedCashAmount,
          countedCashAmount: expectedCashAmount,
          difference: 0,
          closedById: receptionUserId,
          closedAt: appointmentInstant(date, 22 * 60),
        },
      });
      await tx.payment.updateMany({
        where: { id: { in: payments.map((payment) => payment.id) } },
        data: { cashClosingId: closing.id },
      });
    });
    result.closings++;
  }

  return result;
}
