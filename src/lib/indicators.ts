import type { AppointmentStatus, Weekday } from "@/generated/prisma/enums";
import type { MinuteRange } from "@/lib/appointment-slots";
import { subtractRange } from "@/lib/calendar";
import { addDays, toLocalSlot, weekdayOf } from "@/lib/schedule";

// Indicadores del tablero del gerente (HU-22). Funciones puras: la DAL trae
// los datos y acá se calcula, para poder probarlo sin base. No lleva
// `server-only`: la página usa los helpers del período.
//
// Todo va en hora del centro. El período son meses completos (`AAAA-MM`).

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MAX_PERIOD_MONTHS = 3;

/// Meses completos, inclusive, en formato `AAAA-MM`.
export type IndicatorPeriod = { from: string; to: string };

/// Valores de un profesional o del centro en un período. Las tasas van de 0
/// a 1, o `null` cuando no hay base para calcularlas.
export type Indicators = {
  availableMinutes: number;
  occupiedMinutes: number;
  occupancyRate: number | null;
  completed: number;
  expired: number;
  absenteeismRate: number | null;
  cancelled: number;
  unclosed: number;
};

/// El mes de una fecha `AAAA-MM-DD`.
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/// Suma meses a un `AAAA-MM`.
export function shiftMonthKey(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return shifted.toISOString().slice(0, 7);
}

/// Cantidad de meses del período, contando los dos extremos. Negativa o cero
/// si está invertido.
export function periodMonthCount(period: IndicatorPeriod): number {
  const [fromYear, fromMonth] = period.from.split("-").map(Number);
  const [toYear, toMonth] = period.to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

/// Primer y último día del período, en `AAAA-MM-DD`.
export function periodBounds(period: IndicatorPeriod) {
  return {
    first: `${period.from}-01`,
    last: addDays(`${shiftMonthKey(period.to, 1)}-01`, -1),
  };
}

/// Todos los días del período, en orden.
export function periodDays(period: IndicatorPeriod): string[] {
  const { first, last } = periodBounds(period);
  const days: string[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

const monthFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/// "septiembre de 2026".
export function formatMonthKey(month: string): string {
  return monthFormat.format(new Date(`${month}-01T00:00:00.000Z`));
}

/// "septiembre de 2026" o "julio de 2026 a septiembre de 2026".
export function formatPeriod(period: IndicatorPeriod): string {
  return period.from === period.to
    ? formatMonthKey(period.from)
    : `${formatMonthKey(period.from)} a ${formatMonthKey(period.to)}`;
}

/// `part / total`, o `null` si no hay base.
export function rate(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

/// Tasa como porcentaje entero para mostrar: "42 %". Sin base, "Sin datos".
export function formatRate(value: number | null): string {
  return value === null ? "Sin datos" : `${Math.round(value * 100)} %`;
}

/// Minutos como horas para mostrar: "12 h" o "12 h 30 min".
export function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (rest === 0) return `${hours} h`;
  return hours === 0 ? `${rest} min` : `${hours} h ${rest} min`;
}

export type ProfessionalIndicatorsInput = {
  /// Días del período (`periodDays`).
  days: string[];
  /// Días en que el centro cerró (`Holiday`), en `AAAA-MM-DD`.
  holidays: ReadonlySet<string>;
  /// Patrón semanal vigente: no hay historial de franjas (supuesto de HU-22).
  windows: { weekday: Weekday; startMinute: number; endMinute: number }[];
  /// Ausencias del período. Sin horario, el día entero.
  exceptions: {
    date: string;
    startMinute: number | null;
    endMinute: number | null;
  }[];
  /// Día de la baja: desde ese día no suma minutos. `null` si está activo.
  deactivatedOn: string | null;
  /// Turnos que empiezan en el período, en cualquier estado.
  appointments: {
    startsAt: Date;
    endsAt: Date;
    status: AppointmentStatus;
  }[];
  now: Date;
};

/// Tramos disponibles de un profesional por día: la franja menos ausencias,
/// sin feriados ni días desde su baja.
export function availableRangesByDay(
  input: Omit<ProfessionalIndicatorsInput, "appointments" | "now">,
): Map<string, MinuteRange[]> {
  const byDay = new Map<string, MinuteRange[]>();
  for (const day of input.days) {
    if (input.holidays.has(day)) continue;
    if (input.deactivatedOn !== null && day >= input.deactivatedOn) continue;
    const weekday = weekdayOf(day);
    const windows = input.windows
      .filter((window) => window.weekday === weekday)
      .map(({ startMinute, endMinute }) => ({ startMinute, endMinute }));
    if (windows.length === 0) continue;
    const ranges = input.exceptions
      .filter((exception) => exception.date === day)
      .map((exception) =>
        exception.startMinute === null || exception.endMinute === null
          ? { startMinute: 0, endMinute: 1440 }
          : {
              startMinute: exception.startMinute,
              endMinute: exception.endMinute,
            },
      )
      .reduce(subtractRange, windows);
    if (ranges.length > 0) byDay.set(day, ranges);
  }
  return byDay;
}

function minutes(ranges: MinuteRange[]): number {
  return ranges.reduce(
    (total, range) => total + range.endMinute - range.startMinute,
    0,
  );
}

/// Parte de `range` que cae dentro de `ranges`, en minutos.
function overlapMinutes(ranges: MinuteRange[], range: MinuteRange): number {
  return ranges.reduce(
    (total, available) =>
      total +
      Math.max(
        0,
        Math.min(available.endMinute, range.endMinute) -
          Math.max(available.startMinute, range.startMinute),
      ),
    0,
  );
}

/// Indicadores de un profesional en el período (HU-22).
export function calculateIndicators(
  input: ProfessionalIndicatorsInput,
): Indicators {
  const available = availableRangesByDay(input);
  let availableMinutes = 0;
  for (const ranges of available.values()) availableMinutes += minutes(ranges);

  let occupiedMinutes = 0;
  let completed = 0;
  let expired = 0;
  let cancelled = 0;
  let unclosed = 0;
  for (const appointment of input.appointments) {
    switch (appointment.status) {
      case "COMPLETED":
        completed++;
        break;
      case "EXPIRED":
        expired++;
        break;
      case "CANCELLED":
        cancelled++;
        break;
      case "SCHEDULED":
        if (appointment.endsAt <= input.now) unclosed++;
        break;
    }
    if (
      appointment.status !== "SCHEDULED" &&
      appointment.status !== "COMPLETED"
    )
      continue;
    // Solo cuenta la parte del turno dentro de la franja disponible: un turno
    // en un día cerrado o fuera del patrón vigente no suma (HU-22).
    const start = toLocalSlot(appointment.startsAt);
    const duration =
      (appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60_000;
    occupiedMinutes += overlapMinutes(available.get(start.date) ?? [], {
      startMinute: start.minute,
      endMinute: Math.min(1440, start.minute + duration),
    });
  }

  return withRates({
    availableMinutes,
    occupiedMinutes,
    completed,
    expired,
    cancelled,
    unclosed,
  });
}

function withRates(
  totals: Omit<Indicators, "occupancyRate" | "absenteeismRate">,
): Indicators {
  return {
    ...totals,
    occupancyRate: rate(totals.occupiedMinutes, totals.availableMinutes),
    absenteeismRate: rate(totals.expired, totals.completed + totals.expired),
  };
}

/// Indicadores del centro: suma minutos y cantidades, y recalcula las tasas
/// sobre las sumas (no promedia las tasas de cada profesional).
export function sumIndicators(list: Indicators[]): Indicators {
  const sum = (
    key: keyof Omit<Indicators, "occupancyRate" | "absenteeismRate">,
  ) => list.reduce((total, item) => total + item[key], 0);
  return withRates({
    availableMinutes: sum("availableMinutes"),
    occupiedMinutes: sum("occupiedMinutes"),
    completed: sum("completed"),
    expired: sum("expired"),
    cancelled: sum("cancelled"),
    unclosed: sum("unclosed"),
  });
}

/// Si un profesional tiene algo que mostrar en el período: franjas o turnos.
export function hasActivity(indicators: Indicators, appointmentCount: number) {
  return indicators.availableMinutes > 0 || appointmentCount > 0;
}

/// El mes en curso en hora del centro, como período por defecto.
export function currentPeriod(now = new Date()): IndicatorPeriod {
  const month = monthOf(toLocalSlot(now).date);
  return { from: month, to: month };
}
