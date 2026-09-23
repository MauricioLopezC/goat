import type { ReactNode } from "react";

import type { Weekday } from "@/generated/prisma/enums";
import { WEEKDAYS, WEEKDAY_LABEL, formatMinute } from "@/lib/schedule";

// Vista semanal de las franjas de atención de un profesional (HU-05). Las
// horas fuera de franja quedan sobre `muted` (tray), como pide docs/DESIGN.md.
// Sin "use client": sirve en Server Components y dentro del editor cliente.

export type ScheduleWindow = {
  id: number;
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
  room: { name: string } | null;
  services: { name: string }[];
};

const HOUR_HEIGHT = 48;

export function WeeklySchedule<T extends ScheduleWindow>({
  windows,
  wrapWindow = (_window, content) => content,
}: {
  windows: T[];
  /// Envuelve el contenido de cada franja, por ejemplo en el botón que abre su
  /// edición. Solo lo pasa quien puede modificar la agenda.
  wrapWindow?: (window: T, content: ReactNode) => ReactNode;
}) {
  if (windows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Este profesional todavía no tiene franjas de atención cargadas.
      </p>
    );
  }

  const firstHour = Math.floor(
    Math.min(...windows.map((window) => window.startMinute)) / 60,
  );
  const lastHour = Math.ceil(
    Math.max(...windows.map((window) => window.endMinute)) / 60,
  );
  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, index) => firstHour + index,
  );
  const height = hours.length * HOUR_HEIGHT;
  const offset = (minute: number) =>
    ((minute - firstHour * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-x-2">
        <div />
        {WEEKDAYS.map((weekday) => (
          <p
            key={weekday}
            className="text-label-md text-muted-foreground pb-2 text-center uppercase"
          >
            {WEEKDAY_LABEL[weekday]}
          </p>
        ))}

        <div className="relative" style={{ height }}>
          {hours.map((hour) => (
            <span
              key={hour}
              className="text-label-sm text-muted-foreground absolute right-1 -translate-y-1/2 tabular-nums"
              style={{ top: offset(hour * 60) }}
            >
              {formatMinute(hour * 60)}
            </span>
          ))}
        </div>

        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="bg-muted border-border relative rounded-lg border"
            style={{ height }}
          >
            {windows
              .filter((window) => window.weekday === weekday)
              .map((window) => (
                <div
                  key={window.id}
                  className="absolute inset-x-1"
                  style={{
                    top: offset(window.startMinute),
                    height:
                      offset(window.endMinute) - offset(window.startMinute),
                  }}
                >
                  {wrapWindow(
                    window,
                    <div className="bg-primary-soft border-primary-soft-border text-primary-soft-foreground border-l-primary flex size-full flex-col gap-0.5 overflow-hidden rounded-lg border border-l-4 p-1.5 text-left text-xs">
                      <p className="font-medium tabular-nums">
                        {formatMinute(window.startMinute)}–
                        {formatMinute(window.endMinute)}
                      </p>
                      {window.room && <p>{window.room.name}</p>}
                      <p className="text-muted-foreground">
                        {window.services.length
                          ? window.services
                              .map((service) => service.name)
                              .join(", ")
                          : "Todos sus servicios"}
                      </p>
                    </div>,
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
