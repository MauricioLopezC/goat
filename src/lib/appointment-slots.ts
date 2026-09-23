import { formatMinute, toLocalSlot } from "@/lib/schedule";

export type AvailableSlot = { startTime: string; endTime: string };
export type MinuteRange = { startMinute: number; endMinute: number };

// Salta usa UTC-03:00 durante todo el año. No depende de la zona del navegador.
export function appointmentInstant(date: string, minute: number): Date {
  return new Date(
    new Date(`${date}T00:00:00-03:00`).getTime() + minute * 60_000,
  );
}

export function appointmentDateBounds(now = new Date()) {
  const min = toLocalSlot(now).date;
  const base = new Date(`${min}T00:00:00Z`);
  const day = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + 2);
  const lastDay = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
  ).getUTCDate();
  base.setUTCDate(Math.min(day, lastDay));
  return { min, max: base.toISOString().slice(0, 10) };
}

export function rangesOverlap(
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number,
) {
  return start < otherEnd && otherStart < end;
}

export function calculateAvailableSlots(input: {
  date: string;
  durationMinutes: number;
  windows: MinuteRange[];
  exceptions: { startMinute: number | null; endMinute: number | null }[];
  appointments: { startsAt: Date; endsAt: Date }[];
  holiday: boolean;
  now: Date;
}): AvailableSlot[] {
  if (input.holiday || input.durationMinutes <= 0) return [];
  const slots: AvailableSlot[] = [];
  for (const window of input.windows) {
    for (
      let minute = window.startMinute;
      minute + input.durationMinutes <= window.endMinute;
      minute += input.durationMinutes
    ) {
      const endMinute = minute + input.durationMinutes;
      const start = appointmentInstant(input.date, minute).getTime();
      const end = appointmentInstant(input.date, endMinute).getTime();
      if (start <= input.now.getTime()) continue;
      if (
        input.exceptions.some(
          (exception) =>
            exception.startMinute === null ||
            exception.endMinute === null ||
            rangesOverlap(
              minute,
              endMinute,
              exception.startMinute,
              exception.endMinute,
            ),
        )
      )
        continue;
      if (
        input.appointments.some((appointment) =>
          rangesOverlap(
            start,
            end,
            appointment.startsAt.getTime(),
            appointment.endsAt.getTime(),
          ),
        )
      )
        continue;
      slots.push({
        startTime: formatMinute(minute),
        endTime: formatMinute(endMinute),
      });
    }
  }
  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
