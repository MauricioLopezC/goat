import {
  appointmentInstant,
  calculateAvailableSlots,
  type MinuteRange,
} from "@/lib/appointment-slots";
import {
  addDays,
  getWeekDays,
  isCalendarDate,
  parseTime,
} from "@/lib/schedule";

// Calendario del centro (HU-11). Sin `server-only`: lo usan la página, los
// componentes cliente y los tests. El estado vive en la URL.

export type CalendarView = "day" | "week";

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
    view: view === "week" ? "week" : "day",
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

/// Días que abarca la vista: el día elegido, o su semana de lunes a domingo.
export function calendarRange(query: Pick<CalendarQuery, "view" | "date">) {
  if (query.view === "day") return { from: query.date, to: query.date };
  const week = getWeekDays(query.date);
  return { from: week.monday, to: week.sunday };
}

/// Fecha de la vista anterior (`-1`) o siguiente (`1`).
export function shiftCalendarDate(
  query: Pick<CalendarQuery, "view" | "date">,
  direction: -1 | 1,
): string {
  return addDays(query.date, direction * (query.view === "week" ? 7 : 1));
}

/// Bloque libre (`FreeBlock`, ver glosario), en minutos del día en hora del centro.
export type FreeBlock = MinuteRange;

function subtract(ranges: MinuteRange[], cut: MinuteRange): MinuteRange[] {
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

const FREE_BLOCK_STEP = 5;

/// Hasta qué minuto del día ya pasó: todo si es un día anterior, nada si es
/// uno posterior y, hoy, la hora actual redondeada hacia arriba a 5 minutos
/// (desde ahí se ofrecen los bloques libres).
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
    .reduce<MinuteRange[]>(subtract, [...input.windows])
    .filter((block) => block.endMinute - block.startMinute >= FREE_BLOCK_STEP)
    .sort((a, b) => a.startMinute - b.startMinute);
}
