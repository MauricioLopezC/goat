import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { Role } from "@/generated/prisma/enums";
import { appointmentInstant } from "@/lib/appointment-slots";
import {
  calculateIndicators,
  hasActivity,
  periodBounds,
  periodDays,
  sumIndicators,
} from "@/lib/indicators";
import { addDays, dateFromDb, dateToDb, toLocalSlot } from "@/lib/schedule";
import {
  centerIndicatorsSchema,
  type CenterIndicatorsInput,
} from "@/lib/validation/indicators";

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  active: true,
} as const;

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

  const [professionals, holidays, appointments, professionalOptions] =
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
          startsAt: true,
          endsAt: true,
          status: true,
        },
      }),
      prisma.professional.findMany({
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        select: personSelect,
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
  };
}
