import Link from "next/link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { APPOINTMENT_STATUS_BORDER_CLASS } from "@/lib/appointment-status";
import { calendarHref, type CalendarQuery } from "@/lib/calendar";
import {
  dateToDb,
  formatMinute,
  toLocalSlot,
  WEEKDAY_LABEL,
  weekdayOf,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { CalendarDay, ProfessionalDay } from "./calendar-model";
import { Legend } from "./day-view";

// Vista semana del calendario del centro (HU-11): una fila por profesional y
// una columna por día. Cada celda abre ese día.

function freeLabel(day: ProfessionalDay, bySlot: boolean) {
  if (bySlot)
    return `${day.freeBlocks.length} ${day.freeBlocks.length === 1 ? "horario libre" : "horarios libres"}`;
  const minutes = day.freeBlocks.reduce(
    (total, block) => total + block.endMinute - block.startMinute,
    0,
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours ? `${hours} h ` : ""}${rest ? `${rest} min ` : ""}libres`;
}

function cellStatus(day: ProfessionalDay | undefined, holiday: string | null) {
  if (holiday) return "Feriado";
  if (!day || !day.windows.length) return "Sin atención";
  if (day.absence) return `Ausente: ${day.absence}`;
  return null;
}

export function WeekView({
  days,
  query,
  today,
}: {
  days: CalendarDay[];
  query: CalendarQuery;
  today: string;
}) {
  const rows = new Map<number, ProfessionalDay["professional"]>();
  for (const day of days)
    for (const item of day.professionals)
      rows.set(item.professional.id, item.professional);

  if (!rows.size)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Ningún profesional atiende esta semana</EmptyTitle>
          <EmptyDescription>
            {query.professionalId || query.serviceId
              ? "No hay profesionales con franja de atención para los filtros elegidos."
              : "No hay profesionales con franja de atención cargada."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const dayQuery = (date: string): CalendarQuery => ({
    ...query,
    view: "day",
    date,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full min-w-240 table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-label-md w-44 border-b p-2 text-left uppercase">
                Profesional
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  className={cn(
                    "border-b border-l p-2 text-left font-normal",
                    day.date === today && "bg-primary-soft",
                  )}
                >
                  <Link
                    href={calendarHref(dayQuery(day.date))}
                    className="flex flex-col hover:underline"
                  >
                    <span className="text-label-md uppercase">
                      {WEEKDAY_LABEL[weekdayOf(day.date)]}
                    </span>
                    <span className="tabular-nums">
                      {dateToDb(day.date).getUTCDate()}/
                      {dateToDb(day.date).getUTCMonth() + 1}
                    </span>
                    {day.holiday && (
                      <span className="text-warning-soft-foreground truncate text-xs">
                        Feriado: {day.holiday}
                      </span>
                    )}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows.values()].map((professional) => (
              <tr key={professional.id}>
                <th
                  scope="row"
                  className="border-b p-2 text-left align-top font-medium"
                >
                  {professional.lastName}, {professional.firstName}
                </th>
                {days.map((day) => {
                  const item = day.professionals.find(
                    (entry) => entry.professional.id === professional.id,
                  );
                  const status = cellStatus(item, day.holiday);
                  return (
                    <td
                      key={day.date}
                      className={cn(
                        "border-b border-l p-0 align-top",
                        status && "bg-muted",
                      )}
                    >
                      <Link
                        href={calendarHref({
                          ...dayQuery(day.date),
                          professionalId: professional.id,
                        })}
                        aria-label={`Ver el ${WEEKDAY_LABEL[weekdayOf(day.date)].toLowerCase()} de ${professional.lastName}`}
                        className="hover:bg-accent focus-visible:ring-ring flex h-full min-h-20 flex-col gap-1 p-2 outline-none focus-visible:ring-2 focus-visible:ring-inset"
                      >
                        {item?.appointments.map((appointment) => (
                          <span
                            key={appointment.id}
                            className={cn(
                              "truncate rounded-sm border border-l-4 px-1 text-xs",
                              APPOINTMENT_STATUS_BORDER_CLASS[
                                appointment.status
                              ],
                              appointment.status === "CANCELLED"
                                ? "bg-muted text-muted-foreground line-through"
                                : "bg-card",
                            )}
                          >
                            <span className="tabular-nums">
                              {formatMinute(
                                toLocalSlot(appointment.startsAt).minute,
                              )}
                            </span>{" "}
                            {appointment.patient.lastName}
                          </span>
                        ))}
                        <span className="text-muted-foreground mt-auto text-xs">
                          {status ??
                            (item && item.freeBlocks.length
                              ? freeLabel(item, Boolean(query.serviceId))
                              : "Sin bloques libres")}
                        </span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend freeClickable={false} />
    </div>
  );
}
