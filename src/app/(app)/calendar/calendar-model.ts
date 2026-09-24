import type {
  listAppointments,
  listAvailabilityWindows,
} from "@/lib/dal/appointments";
import {
  appointmentDateBounds,
  type MinuteRange,
} from "@/lib/appointment-slots";
import { calculateFreeBlocks, type FreeBlock } from "@/lib/calendar";
import { toLocalSlot, weekdayOf } from "@/lib/schedule";

export type CalendarAvailability = Awaited<
  ReturnType<typeof listAvailabilityWindows>
>;
export type CalendarAppointment = Awaited<
  ReturnType<typeof listAppointments>
>[number];
type Person = { id: number; firstName: string; lastName: string };

/// Lo que el calendario muestra de un profesional en un día.
export type ProfessionalDay = {
  professional: Person;
  windows: MinuteRange[];
  partialAbsences: (MinuteRange & { reason: string })[];
  /// Motivo de la ausencia de día completo, si la hay.
  absence: string | null;
  /// Tiene franja ese día y no está ausente ni es feriado.
  attends: boolean;
  freeBlocks: FreeBlock[];
  appointments: CalendarAppointment[];
};

export type CalendarDay = {
  date: string;
  holiday: string | null;
  professionals: ProfessionalDay[];
};

/// Arma el día de cada profesional: los que tienen franja ese día y, aunque no
/// la tengan, los que tienen turnos (para no esconder un turno registrado).
export function buildCalendarDay(
  date: string,
  availability: CalendarAvailability,
  appointments: CalendarAppointment[],
  now: Date,
): CalendarDay {
  const bounds = appointmentDateBounds(now);
  const weekday = weekdayOf(date);
  const holiday =
    availability.holidays.find((item) => item.date === date)?.description ??
    null;
  const dayAppointments = appointments.filter(
    (appointment) => toLocalSlot(appointment.startsAt).date === date,
  );

  const professionals: ProfessionalDay[] = availability.professionals
    .map((professional) => {
      const windows = professional.windows
        .filter((window) => window.weekday === weekday)
        .map(({ startMinute, endMinute }) => ({ startMinute, endMinute }));
      const exceptions = professional.exceptions.filter(
        (exception) => exception.date === date,
      );
      const absence =
        exceptions.find(
          (exception) =>
            exception.startMinute === null || exception.endMinute === null,
        )?.reason ?? null;
      return {
        professional: {
          id: professional.id,
          firstName: professional.firstName,
          lastName: professional.lastName,
        },
        windows,
        partialAbsences: exceptions.flatMap((exception) =>
          exception.startMinute === null || exception.endMinute === null
            ? []
            : [
                {
                  startMinute: exception.startMinute,
                  endMinute: exception.endMinute,
                  reason: exception.reason,
                },
              ],
        ),
        absence,
        attends: windows.length > 0 && !holiday && !absence,
        freeBlocks: calculateFreeBlocks({
          date,
          windows,
          exceptions,
          busy: professional.busy,
          holiday: Boolean(holiday),
          now,
          today: bounds.min,
          maxDate: bounds.max,
          durationMinutes: availability.serviceDurationMinutes,
        }),
        appointments: dayAppointments.filter(
          (appointment) => appointment.professional.id === professional.id,
        ),
      };
    })
    .filter((day) => day.windows.length > 0 || day.appointments.length > 0);

  // Turnos de profesionales que no están en la disponibilidad (por ejemplo,
  // dados de baja después de atender).
  const listed = new Set(availability.professionals.map((item) => item.id));
  for (const appointment of dayAppointments) {
    if (listed.has(appointment.professional.id)) continue;
    listed.add(appointment.professional.id);
    professionals.push({
      professional: appointment.professional,
      windows: [],
      partialAbsences: [],
      absence: null,
      attends: false,
      freeBlocks: [],
      appointments: dayAppointments.filter(
        (item) => item.professional.id === appointment.professional.id,
      ),
    });
  }

  return { date, holiday, professionals };
}

/// Rango de horas a dibujar: el que cubre franjas y turnos, o 8 a 18.
export function hourRange(days: ProfessionalDay[]) {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const day of days) {
    for (const window of day.windows) {
      starts.push(window.startMinute);
      ends.push(window.endMinute);
    }
    for (const appointment of day.appointments) {
      const start = toLocalSlot(appointment.startsAt);
      const end = toLocalSlot(appointment.endsAt);
      starts.push(start.minute);
      ends.push(end.date === start.date ? end.minute : 1440);
    }
  }
  return {
    firstHour: starts.length ? Math.floor(Math.min(...starts) / 60) : 8,
    lastHour: ends.length ? Math.ceil(Math.max(...ends) / 60) : 18,
  };
}
