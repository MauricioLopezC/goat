import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { Role } from "@/generated/prisma/enums";
import { appointmentInstant } from "@/lib/appointment-slots";
import { calculateCenterMetrics } from "@/lib/center-metrics";
import { calculateProfessionalMetrics } from "@/lib/professional-metrics";
import {
  calculateIndicators,
  hasActivity,
  periodBounds,
  periodDays,
  periodMonthCount,
  shiftMonthKey,
  sumIndicators,
} from "@/lib/indicators";
import { addDays, dateFromDb, dateToDb, toLocalSlot } from "@/lib/schedule";
import {
  centerIndicatorsSchema,
  type CenterIndicatorsInput,
  professionalIndicatorsSchema,
  type ProfessionalIndicatorsInput,
} from "@/lib/validation/indicators";

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  active: true,
} as const;

function decimalCents(amount: { toString(): string }) {
  const [whole, fraction = ""] = amount.toString().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/// Ocupación, ausentismo, cancelaciones y turnos sin cerrar del período, del
/// centro y por profesional (HU-22). Lee franjas, ausencias, feriados y
/// turnos, y calcula en memoria con `calculateIndicators`.
export async function getCenterIndicators(
  input: CenterIndicatorsInput,
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  const parsed = centerIndicatorsSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Revisá el período elegido.",
    );
  const { from, to, professionalId } = parsed.data;
  const period = { from, to };
  const { first, last } = periodBounds(period);
  const days = periodDays(period);
  const onlyProfessional = professionalId ? { id: professionalId } : {};

  const [professionals, holidays, appointments, professionalOptions, payments] =
    await Promise.all([
      prisma.professional.findMany({
        where: onlyProfessional,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        select: {
          ...personSelect,
          deactivatedAt: true,
          availabilityWindows: {
            select: { weekday: true, startMinute: true, endMinute: true },
          },
          exceptions: {
            where: {
              startDate: { lte: dateToDb(last) },
              endDate: { gte: dateToDb(first) },
            },
            select: {
              startDate: true,
              endDate: true,
              startMinute: true,
              endMinute: true,
            },
          },
        },
      }),
      prisma.holiday.findMany({
        where: {
          startDate: { lte: dateToDb(last) },
          endDate: { gte: dateToDb(first) },
        },
        select: {
          startDate: true,
          endDate: true,
          startMinute: true,
          endMinute: true,
        },
      }),
      // Un turno pertenece al período por su inicio, en hora del centro.
      prisma.appointment.findMany({
        where: {
          startsAt: {
            gte: appointmentInstant(first, 0),
            lt: appointmentInstant(addDays(last, 1), 0),
          },
          ...(professionalId ? { professionalId } : {}),
        },
        select: {
          professionalId: true,
          patientId: true,
          serviceId: true,
          service: {
            select: {
              name: true,
              specialtyId: true,
              specialty: { select: { name: true } },
            },
          },
          startsAt: true,
          endsAt: true,
          status: true,
        },
      }),
      prisma.professional.findMany({
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        select: personSelect,
      }),
      prisma.payment.findMany({
        where: {
          status: "PAID",
          createdAt: {
            gte: appointmentInstant(
              `${shiftMonthKey(from, -periodMonthCount(period))}-01`,
              0,
            ),
            lt: appointmentInstant(`${shiftMonthKey(to, 1)}-01`, 0),
          },
          ...(professionalId ? { appointment: { professionalId } } : {}),
        },
        select: {
          createdAt: true,
          amount: true,
          paymentMethod: { select: { name: true } },
        },
      }),
    ]);
  if (professionalId && professionals.length === 0)
    throw new DomainError("NOT_FOUND", "El profesional no existe.");

  const closedDays = new Set<string>();
  const holidayRanges: {
    date: string;
    startMinute: number | null;
    endMinute: number | null;
  }[] = [];

  for (const holiday of holidays) {
    const hStart = dateFromDb(holiday.startDate);
    const hEnd = dateFromDb(holiday.endDate);
    const fromDay = hStart < first ? first : hStart;
    const toDay = hEnd > last ? last : hEnd;
    for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
      if (holiday.startMinute === null || holiday.endMinute === null) {
        closedDays.add(day);
      } else {
        holidayRanges.push({
          date: day,
          startMinute: holiday.startMinute,
          endMinute: holiday.endMinute,
        });
      }
    }
  }

  const now = new Date();
  const rows = professionals.flatMap(
    ({ availabilityWindows, exceptions, deactivatedAt, ...professional }) => {
      const own = appointments.filter(
        (appointment) => appointment.professionalId === professional.id,
      );

      const expandedExceptions: {
        date: string;
        startMinute: number | null;
        endMinute: number | null;
      }[] = [];

      for (const exception of exceptions) {
        const eStart = dateFromDb(exception.startDate);
        const eEnd = dateFromDb(exception.endDate);
        const fromDay = eStart < first ? first : eStart;
        const toDay = eEnd > last ? last : eEnd;
        for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
          expandedExceptions.push({
            date: day,
            startMinute: exception.startMinute,
            endMinute: exception.endMinute,
          });
        }
      }

      const indicators = calculateIndicators({
        days,
        holidays: closedDays,
        holidayRanges,
        windows: availabilityWindows,
        exceptions: expandedExceptions,
        // La baja tiene fecha efectiva: desde ese día no atiende (HU-03).
        deactivatedOn:
          !professional.active && deactivatedAt
            ? toLocalSlot(deactivatedAt).date
            : null,
        appointments: own,
        now,
      });
      return hasActivity(indicators, own.length)
        ? [{ ...professional, ...indicators }]
        : [];
    },
  );

  return {
    period,
    center: sumIndicators(rows),
    professionals: rows,
    professionalOptions,
    details: calculateCenterMetrics(
      period,
      appointments.map((appointment) => ({
        professionalId: appointment.professionalId,
        patientId: appointment.patientId,
        serviceId: appointment.serviceId,
        serviceName: appointment.service.name,
        specialtyId: appointment.service.specialtyId,
        specialtyName: appointment.service.specialty?.name ?? null,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
      })),
      payments.map((payment) => ({
        createdAt: payment.createdAt,
        amountCents: decimalCents(payment.amount),
        methodName: payment.paymentMethod.name,
      })),
    ),
  };
}

/// Tablero del profesional (HU-30): turnos totales, porcentajes por estado,
/// turnos por servicio, pacientes atendidos, nuevos y distribución por sexo y edad.
export async function getProfessionalIndicators(
  input: ProfessionalIndicatorsInput,
  actor: Actor,
) {
  assertRole(actor, Role.PROFESSIONAL);
  const parsed = professionalIndicatorsSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Revisá el período elegido.",
    );

  const own = await prisma.professional.findUnique({
    where: { userId: actor.id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!own)
    throw new DomainError("NOT_FOUND", "No se encontró el perfil profesional.");

  const { from, to } = parsed.data;
  const period = { from, to };
  const { first, last } = periodBounds(period);
  const periodStart = appointmentInstant(first, 0);
  const periodEnd = appointmentInstant(addDays(last, 1), 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      professionalId: own.id,
      startsAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
    select: {
      id: true,
      patientId: true,
      serviceId: true,
      service: { select: { name: true } },
      startsAt: true,
      status: true,
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });

  const completedPatientIds = Array.from(
    new Set(
      appointments
        .filter((a) => a.status === "COMPLETED")
        .map((a) => a.patientId),
    ),
  );

  const [patients, priorAppointments] = await Promise.all([
    completedPatientIds.length > 0
      ? prisma.patient.findMany({
          where: { id: { in: completedPatientIds } },
          select: { id: true, gender: true, birthDate: true },
        })
      : [],
    completedPatientIds.length > 0
      ? prisma.appointment.findMany({
          where: {
            professionalId: own.id,
            patientId: { in: completedPatientIds },
            status: "COMPLETED",
            startsAt: { lt: periodStart },
          },
          select: { patientId: true },
          distinct: ["patientId"],
        })
      : [],
  ]);

  const priorPatientIds = new Set(priorAppointments.map((a) => a.patientId));

  const metrics = calculateProfessionalMetrics(
    period,
    appointments.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      serviceId: a.serviceId,
      serviceName: a.service.name,
      startsAt: a.startsAt,
      status: a.status,
    })),
    patients,
    priorPatientIds,
  );

  return {
    professional: own,
    period,
    metrics,
  };
}
