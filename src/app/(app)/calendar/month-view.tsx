import Link from "next/link";
import { calendarHref, type CalendarQuery } from "@/lib/calendar";
import { appointmentDateBounds } from "@/lib/appointment-slots";
import { Weekday } from "@/generated/prisma/enums";
import { WEEKDAYS, WEEKDAY_LABEL } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { summarizeCalendarDay, type CalendarDay } from "./calendar-model";
import { Legend } from "./day-view";

export type MonthGridDay = {
  date: string;
  dayNumber: number;
  weekday: Weekday;
  isToday: boolean;
  isPast: boolean;
  isOutsideHorizon: boolean;
  holiday: string | null;
  scheduledCount: number;
  completedCount: number;
  freeBlocksCount: number;
  href: string;
};

type CellItem =
  { type: "blank"; key: string } | { type: "day"; day: MonthGridDay };

export function MonthGrid({
  days,
  leadingBlankDays,
  trailingBlankDays,
}: {
  days: MonthGridDay[];
  leadingBlankDays: number;
  trailingBlankDays: number;
}) {
  const cells: CellItem[] = [];

  for (let i = 0; i < leadingBlankDays; i++) {
    cells.push({ type: "blank", key: `leading-${i}` });
  }

  for (const day of days) {
    cells.push({ type: "day", day });
  }

  for (let i = 0; i < trailingBlankDays; i++) {
    cells.push({ type: "blank", key: `trailing-${i}` });
  }

  const rows: CellItem[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full min-w-220 table-fixed border-collapse text-sm">
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th
                key={weekday}
                className="text-label-md border-b border-l first:border-l-0 p-2 text-center uppercase text-muted-foreground"
              >
                {WEEKDAY_LABEL[weekday]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, colIndex) => {
                if (cell.type === "blank") {
                  return (
                    <td
                      key={cell.key}
                      className={cn(
                        "border-b border-l p-0 h-28 bg-muted/20",
                        colIndex === 0 && "border-l-0",
                      )}
                    />
                  );
                }

                const day = cell.day;
                const isClosed = Boolean(day.holiday);

                return (
                  <td
                    key={day.date}
                    className={cn(
                      "border-b border-l p-0 align-top transition-colors h-28 sm:h-32",
                      colIndex === 0 && "border-l-0",
                      isClosed && "bg-holiday/15 border-holiday/30",
                      day.isToday && !isClosed && "bg-primary-soft/20",
                      day.isPast && !isClosed && "bg-muted/10",
                    )}
                  >
                    <Link
                      href={day.href}
                      aria-label={`Ver turnos del ${day.dayNumber}`}
                      className={cn(
                        "flex h-full flex-col p-2 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        isClosed && "hover:bg-holiday/20",
                      )}
                    >
                      {/* Cabecera del día */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            day.isToday
                              ? "flex size-5 sm:size-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold"
                              : isClosed
                                ? "text-holiday-foreground font-bold"
                                : "text-foreground",
                          )}
                        >
                          {day.dayNumber}
                        </span>

                        {isClosed && (
                          <span
                            className="rounded bg-holiday/25 border border-holiday/40 px-1 py-0.5 text-[10px] font-bold text-holiday-foreground truncate max-w-[90px] sm:max-w-[120px]"
                            title={`Cerrado: ${day.holiday}`}
                          >
                            Cerrado
                          </span>
                        )}
                      </div>

                      {/* Contenido del día */}
                      {isClosed ? (
                        <div className="flex flex-col gap-1 my-auto text-left">
                          <span className="text-[11px] font-bold text-holiday-foreground line-clamp-2 leading-tight">
                            {day.holiday}
                          </span>
                          <span className="text-[10px] font-medium text-holiday-muted-foreground/90">
                            Sin atención
                          </span>
                        </div>
                      ) : (
                        <>
                          {/* Turnos programados y completados */}
                          <div className="flex flex-wrap gap-1">
                            {day.scheduledCount > 0 && (
                              <span
                                className="inline-flex items-center rounded-sm bg-scheduled-soft text-scheduled-soft-foreground border border-scheduled-soft-border px-1 py-0.5 text-[11px] font-medium leading-tight shadow-2xs"
                                title={`${day.scheduledCount} ${day.scheduledCount === 1 ? "turno programado" : "turnos programados"}`}
                              >
                                {day.scheduledCount} prog.
                              </span>
                            )}
                            {day.completedCount > 0 && (
                              <span
                                className="inline-flex items-center rounded-sm bg-success-soft text-success-soft-foreground border border-success-soft-border px-1 py-0.5 text-[11px] font-medium leading-tight shadow-2xs"
                                title={`${day.completedCount} ${day.completedCount === 1 ? "turno completado" : "turnos completados"}`}
                              >
                                {day.completedCount} comp.
                              </span>
                            )}
                          </div>

                          {/* Bloques libres o estado de atención */}
                          <div className="mt-auto pt-1">
                            {day.freeBlocksCount > 0 ? (
                              <span className="inline-flex w-full items-center justify-center gap-1 rounded border border-dashed border-primary/70 bg-primary-soft px-1.5 py-0.5 text-[11px] font-bold text-primary shadow-xs truncate">
                                <span className="inline-block size-1.5 rounded-full bg-primary shrink-0" />
                                {day.freeBlocksCount}{" "}
                                {day.freeBlocksCount === 1 ? "libre" : "libres"}
                              </span>
                            ) : day.isPast ? (
                              <span className="text-[11px] text-muted-foreground">
                                {day.scheduledCount || day.completedCount
                                  ? ""
                                  : "Sin turnos"}
                              </span>
                            ) : day.isOutsideHorizon ? (
                              <span className="text-[11px] text-muted-foreground">
                                Fuera de horizonte
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                {day.scheduledCount || day.completedCount
                                  ? "Sin bloques libres"
                                  : "Sin atención"}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonthView({
  days,
  leadingBlankDays,
  trailingBlankDays,
  query,
  today,
  now = new Date(),
}: {
  days: CalendarDay[];
  leadingBlankDays: number;
  trailingBlankDays: number;
  query: CalendarQuery;
  today: string;
  now?: Date;
}) {
  const bounds = appointmentDateBounds(now);

  const gridDays: MonthGridDay[] = days.map((day) => {
    const summary = summarizeCalendarDay(day);
    const dayNumber = Number(day.date.slice(8, 10));
    const weekday =
      WEEKDAYS[(new Date(`${day.date}T12:00:00Z`).getUTCDay() + 6) % 7];

    return {
      date: day.date,
      dayNumber,
      weekday,
      isToday: day.date === today,
      isPast: day.date < today,
      isOutsideHorizon: day.date > bounds.max,
      holiday: day.holiday,
      scheduledCount: summary.scheduledCount,
      completedCount: summary.completedCount,
      freeBlocksCount: summary.freeBlocksCount,
      href: calendarHref({
        ...query,
        view: "day",
        date: day.date,
      }),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <MonthGrid
        days={gridDays}
        leadingBlankDays={leadingBlankDays}
        trailingBlankDays={trailingBlankDays}
      />
      <Legend freeClickable={false} />
    </div>
  );
}
