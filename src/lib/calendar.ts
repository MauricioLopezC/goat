import {
  appointmentInstant,
  calculateAvailableSlots,
  type MinuteRange,
} from "@/lib/appointment-slots";
import {
  addDays,
  getMonthRange,
  getWeekDays,
  isCalendarDate,
  parseTime,
  shiftMonth,
  toLocalSlot,
} from "@/lib/schedule";

// Calendario del centro (HU-11, HU-15). Sin `server-only`: lo usan la página, los
// componentes cliente y los tests. El estado vive en la URL.

export type CalendarView = "day" | "week" | "month";

export type CalendarQuery = {
  view: CalendarView;
  date: string;
  professionalId?: number;
  serviceId?: number;
  hideCancelled: boolean;
};

type SearchParams = Record<string, string | string[] | undefined>;

function positiveId(value: string | string[] | undefined) {
  const id = typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/// Lee la vista, la fecha y los filtros de la URL. Lo inválido cae en el valor
/// por defecto: vista día y la fecha indicada (hoy, en el calendario).
export function parseCalendarQuery(
  params: SearchParams,
  fallbackDate: string,
): CalendarQuery {
  const { view, date, hideCancelled } = params;
  return {
    view: view === "month" ? "month" : view === "week" ? "week" : "day",
    date:
      typeof date === "string" && isCalendarDate(date) ? date : fallbackDate,
    professionalId: positiveId(params.professionalId),
    serviceId: positiveId(params.serviceId),
    hideCancelled: hideCancelled === "1",
  };
}

/// Inversa de `parseCalendarQuery`: omite los valores por defecto.
export function calendarSearch(query: CalendarQuery): string {
  const search = new URLSearchParams();
  if (query.view !== "day") search.set("view", query.view);
  search.set("date", query.date);
  if (query.professionalId)
    search.set("professionalId", String(query.professionalId));
  if (query.serviceId) search.set("serviceId", String(query.serviceId));
  if (query.hideCancelled) search.set("hideCancelled", "1");
  return search.toString();
}

export function calendarHref(query: CalendarQuery): string {
  return `/calendar?${calendarSearch(query)}`;
}

/// Días que abarca la vista: el día elegido, su semana de lunes a domingo,
/// o el mes calendario completo (del 1 al último día).
export function calendarRange(query: Pick<CalendarQuery, "view" | "date">) {
  if (query.view === "day") return { from: query.date, to: query.date };
  if (query.view === "week") {
    const week = getWeekDays(query.date);
    return { from: week.monday, to: week.sunday };
  }
  return getMonthRange(query.date);
}

/// Fecha de la vista anterior (`-1`) o siguiente (`1`).
export function shiftCalendarDate(
  query: Pick<CalendarQuery, "view" | "date">,
  direction: -1 | 1,
): string {
  if (query.view === "month") return shiftMonth(query.date, direction);
  return addDays(query.date, direction * (query.view === "week" ? 7 : 1));
}

/// Resumen de actividad y disponibilidad de un día (HU-15).
export type DaySummary = {
  date: string;
  holiday: string | null;
  scheduledCount: number;
  completedCount: number;
  freeBlocksCount: number;
};

export type DaySummaryInput = {
  date: string;
  holiday: string | null;
  appointments: { startsAt: Date | string; status: string }[];
  professionals: Array<{
    windows: MinuteRange[];
    exceptions: { startMinute: number | null; endMinute: number | null }[];
    busy: { startsAt: Date; endsAt: Date }[];
  }>;
  serviceDurationMinutes?: number;
  now: Date;
  today: string;
  maxDate: string;
};

/// Calcula de forma pura el resumen de un día para la vista mensual (HU-15).
export function calculateDaySummary(input: DaySummaryInput): DaySummary {
  const isPast = input.date < input.today;
  const isOutside = input.date > input.maxDate;
  const isClosed = Boolean(input.holiday);

  let scheduledCount = 0;
  let completedCount = 0;

  for (const app of input.appointments) {
    const appDate =
      typeof app.startsAt === "string"
        ? app.startsAt.slice(0, 10)
        : toLocalSlot(app.startsAt).date;
    if (appDate === input.date) {
      if (app.status === "SCHEDULED") scheduledCount++;
      else if (app.status === "COMPLETED") completedCount++;
    }
  }

  let freeBlocksCount = 0;
  if (!isClosed && !isPast && !isOutside) {
    for (const prof of input.professionals) {
      const blocks = calculateFreeBlocks({
        date: input.date,
        windows: prof.windows,
        exceptions: prof.exceptions,
        busy: prof.busy,
        holiday: isClosed,
        now: input.now,
        today: input.today,
        maxDate: input.maxDate,
        durationMinutes: input.serviceDurationMinutes,
      });
      freeBlocksCount += blocks.length;
    }
  }

  return {
    date: input.date,
    holiday: input.holiday,
    scheduledCount,
    completedCount,
    freeBlocksCount,
  };
}

/// Bloque libre (`FreeBlock`, ver glosario), en minutos del día en hora del centro.
export type FreeBlock = MinuteRange;

/// Quita un tramo a una lista de tramos del día. También la usan los
/// indicadores para descontar ausencias de la franja (HU-22).
export function subtractRange(
  ranges: MinuteRange[],
  cut: MinuteRange,
): MinuteRange[] {
  return ranges.flatMap((range) => {
    if (
      cut.endMinute <= range.startMinute ||
      cut.startMinute >= range.endMinute
    )
      return [range];
    return [
      { startMinute: range.startMinute, endMinute: cut.startMinute },
      { startMinute: cut.endMinute, endMinute: range.endMinute },
    ].filter((piece) => piece.startMinute < piece.endMinute);
  });
}

/// Duración mínima de un bloque libre e intervalo de grilla del centro (30 min, HU-06, HU-11).
/// Los tramos menores a este umbral no son asignables a ningún turno, y el tiempo
/// transcurrido hoy se redondea hacia arriba a este intervalo para no ofrecer horarios
/// fraccionados o no válidos para el alta de turnos.
export const MIN_FREE_BLOCK_MINUTES = 30;

export const FREE_BLOCK_STEP = MIN_FREE_BLOCK_MINUTES;

/// Hasta qué minuto del día ya pasó: todo si es un día anterior, nada si es
/// uno posterior y, hoy, la hora actual redondeada hacia arriba al intervalo
/// de grilla del centro (30 min, desde donde se pueden ofrecer bloques libres asignables).
export function pastUntilMinute(date: string, today: string, now: Date) {
  if (date < today) return 1440;
  if (date > today) return 0;
  const elapsed =
    (now.getTime() - appointmentInstant(date, 0).getTime()) / 60_000;
  return Math.min(
    1440,
    Math.max(0, Math.ceil(elapsed / FREE_BLOCK_STEP) * FREE_BLOCK_STEP),
  );
}

/// Bloques libres de un profesional en un día. Sin servicio, son los tramos
/// de franja sin feriado, ausencia ni turno que ocupe. Con servicio, la misma
/// grilla que ofrece el alta (HU-09). Solo se ofrece lo que el alta aceptaría:
/// desde ahora hasta el límite de dos meses (`maxDate`).
export function calculateFreeBlocks(input: {
  date: string;
  windows: MinuteRange[];
  exceptions: { startMinute: number | null; endMinute: number | null }[];
  /// Turnos que ocupan (Programados o Completados), de cualquier servicio.
  busy: { startsAt: Date; endsAt: Date }[];
  holiday: boolean;
  now: Date;
  today: string;
  maxDate: string;
  durationMinutes?: number;
}): FreeBlock[] {
  if (input.holiday || input.date < input.today || input.date > input.maxDate)
    return [];
  if (input.durationMinutes)
    return calculateAvailableSlots({
      date: input.date,
      durationMinutes: input.durationMinutes,
      windows: input.windows,
      exceptions: input.exceptions,
      appointments: input.busy,
      holiday: false,
      now: input.now,
    }).map((slot) => ({
      startMinute: parseTime(slot.startTime),
      endMinute: parseTime(slot.endTime),
    }));

  const dayStart = appointmentInstant(input.date, 0).getTime();
  const toMinute = (instant: Date) =>
    Math.min(1440, Math.max(0, (instant.getTime() - dayStart) / 60_000));
  const cuts: MinuteRange[] = [
    ...input.exceptions.map((exception) =>
      exception.startMinute === null || exception.endMinute === null
        ? { startMinute: 0, endMinute: 1440 }
        : {
            startMinute: exception.startMinute,
            endMinute: exception.endMinute,
          },
    ),
    ...input.busy.map((appointment) => ({
      startMinute: toMinute(appointment.startsAt),
      endMinute: toMinute(appointment.endsAt),
    })),
  ];
  const past = pastUntilMinute(input.date, input.today, input.now);
  if (past) cuts.push({ startMinute: 0, endMinute: past });
  return cuts
    .reduce<MinuteRange[]>(subtractRange, [...input.windows])
    .filter(
      (block) => block.endMinute - block.startMinute >= MIN_FREE_BLOCK_MINUTES,
    )
    .sort((a, b) => a.startMinute - b.startMinute);
}
