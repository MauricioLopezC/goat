import { Weekday } from "@/generated/prisma/enums";

// Horarios de la agenda (HU-05). No lleva `server-only` a propósito: lo usan
// la DAL, los schemas de Zod y los componentes cliente.
//
// Las franjas y las excepciones se guardan en hora local del centro, como
// minutos desde la medianoche. Los turnos, como instantes (`timestamptz`).
// `toLocalSlot` es el puente entre los dos.

/// Zona horaria del centro (Salta). Argentina no tiene horario de verano.
export const CENTER_TIME_ZONE = "America/Argentina/Buenos_Aires";

/// Orden de la semana en la agenda: de lunes a domingo.
export const WEEKDAYS = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
] as const;

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

/// Turno programado que un cambio de agenda dejaría fuera de horario. Viaja en
/// `meta.appointments` de `FUTURE_APPOINTMENTS` para que la UI lo liste.
export type AffectedAppointment = {
  id: number;
  /// ISO 8601.
  startsAt: string;
  patientName: string;
  serviceName: string;
  professionalName: string;
};

/// `HH:MM` de 00:00 a 23:59, como lo entrega `<input type="time">`.
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/// `AAAA-MM-DD`.
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/// Minutos desde la medianoche a `HH:MM`.
export function formatMinute(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, "0");
  const minutes = String(minute % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/// `HH:MM` a minutos desde la medianoche. Supone el formato de `TIME_PATTERN`.
export function parseTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/// Si `AAAA-MM-DD` es una fecha que existe en el calendario (descarta, por
/// ejemplo, el 30 de febrero).
export function isCalendarDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

/// Una columna `@db.Date` en Prisma: la fecha a medianoche UTC.
export function dateToDb(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/// Inversa de `dateToDb`.
export function dateFromDb(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/// `AAAA-MM-DD` legible, sin correrse de día por la zona horaria.
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateToDb(date));
}

const localParts = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTER_TIME_ZONE,
  weekday: "long",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/// Fecha, día de la semana y minuto de un instante, en hora del centro.
export function toLocalSlot(instant: Date): {
  date: string;
  weekday: Weekday;
  minute: number;
} {
  const parts = Object.fromEntries(
    localParts.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday.toUpperCase() as Weekday,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/// Fecha y hora de un instante en hora del centro, para mensajes y listados.
export function formatInstant(instant: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: CENTER_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/// Devuelve los 7 días (Lunes a Domingo) de la semana que contiene a `dateStr` (AAAA-MM-DD).
export function getWeekDays(dateStr: string): {
  monday: string;
  sunday: string;
  days: Array<{
    date: string;
    weekday: Weekday;
    dayNumber: number;
  }>;
} {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dayOfWeek = d.getUTCDay(); // 0 es domingo, 1 es lunes
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);

  const days: Array<{ date: string; weekday: Weekday; dayNumber: number }> = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setUTCDate(monday.getUTCDate() + i);
    const date = cur.toISOString().slice(0, 10);
    days.push({
      date,
      weekday: WEEKDAYS[i],
      dayNumber: cur.getUTCDate(),
    });
  }

  return {
    monday: days[0].date,
    sunday: days[6].date,
    days,
  };
}

/// Suma o resta días a una fecha en formato AAAA-MM-DD.
export function addDays(dateStr: string, daysToAdd: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  return d.toISOString().slice(0, 10);
}

/// Formatea el rango de la semana para títulos de la agenda (ej: "28 de sep – 4 de oct de 2026").
export function formatWeekRange(monday: string, sunday: string): string {
  const m = dateToDb(monday);
  const s = dateToDb(sunday);
  const mMonth = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    month: "short",
  }).format(m);
  const sMonth = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    month: "short",
  }).format(s);
  const sYear = s.getUTCFullYear();
  if (mMonth === sMonth) {
    return `${m.getUTCDate()} al ${s.getUTCDate()} de ${sMonth} de ${sYear}`;
  }
  return `${m.getUTCDate()} de ${mMonth} – ${s.getUTCDate()} de ${sMonth} de ${sYear}`;
}
