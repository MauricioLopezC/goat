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

  const professionals = [...rows.values()].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, "es") ||
      a.firstName.localeCompare(b.firstName, "es"),
  );

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
                    "border-b border-l p-2 text-left font-normal transition-colors",
                    day.date === today && !day.holiday && "bg-primary-soft",
                    day.holiday &&
                      "bg-holiday/15 border-b-2 border-b-holiday/50",
                  )}
                >
                  <Link
                    href={calendarHref(dayQuery(day.date))}
                    className="flex flex-col hover:underline"
                  >
                    <span
                      className={cn(
                        "text-label-md uppercase",
                        day.holiday
                          ? "text-holiday-foreground font-bold"
                          : "text-muted-foreground",
                      )}
                    >
                      {WEEKDAY_LABEL[weekdayOf(day.date)]}
                    </span>
                    <span
                      className={cn(
                        "tabular-nums font-semibold",
                        day.holiday && "text-holiday-foreground font-bold",
                      )}
                    >
                      {dateToDb(day.date).getUTCDate()}/
                      {dateToDb(day.date).getUTCMonth() + 1}
                    </span>
                    {day.holiday && (
                      <span
                        className="mt-0.5 rounded bg-holiday/25 border border-holiday/40 px-1 py-0.5 text-[10px] font-bold text-holiday-foreground truncate max-w-[140px]"
                        title={`Feriado: ${day.holiday}`}
                      >
                        Feriado: {day.holiday}
                      </span>
                    )}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {professionals.map((professional, pIndex) => (
              <tr key={professional.id}>
                <th
                  scope="row"
                  className="border-b p-2 text-left align-top font-medium"
                >
                  {professional.lastName}, {professional.firstName}
                </th>
                {days.map((day) => {
                  if (day.holiday) {
                    if (pIndex > 0) return null;
                    return (
                      <td
                        key={day.date}
                        rowSpan={professionals.length}
                        className="border-b border-l border-holiday/30 bg-holiday/15 p-3 align-middle text-center transition-colors"
                      >
                        <Link
                          href={calendarHref(dayQuery(day.date))}
                          aria-label={`Ver feriado ${day.holiday}`}
                          className="focus-visible:ring-ring flex h-full min-h-36 flex-col items-center justify-center gap-2 rounded-lg p-2 text-center outline-none transition-colors hover:bg-holiday/20 focus-visible:ring-2"
                        >
                          <span className="rounded-full bg-holiday/25 border border-holiday/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-holiday-foreground">
                            Centro cerrado
                          </span>
                          <span className="text-sm font-bold text-holiday-foreground">
                            {day.holiday}
                          </span>
                          <span className="text-xs text-holiday-muted-foreground/80 max-w-[160px] leading-tight font-medium">
                            Cerrado para atención médica, recepción y gerencia
                          </span>
                        </Link>
                      </td>
                    );
                  }

                  const item = day.professionals.find(
                    (entry) => entry.professional.id === professional.id,
                  );
                  const status = cellStatus(item, day.holiday);
                  const hasAppointments = Boolean(item?.appointments.length);
                  const hasFreeBlocks = Boolean(
                    item && item.freeBlocks.length > 0 && day.date >= today,
                  );

                  return (
                    <td
                      key={day.date}
                      className={cn(
                        "border-b border-l p-0 align-top transition-colors",
                        status && "bg-muted",
                      )}
                    >
                      <Link
                        href={calendarHref({
                          ...dayQuery(day.date),
                          professionalId: professional.id,
                        })}
                        aria-label={`Ver el ${WEEKDAY_LABEL[weekdayOf(day.date)].toLowerCase()} de ${professional.lastName}`}
                        className="hover:bg-accent/40 focus-visible:ring-ring flex h-full min-h-20 flex-col gap-1.5 p-2 outline-none focus-visible:ring-2 focus-visible:ring-inset"
                      >
                        {item?.appointments.map((appointment) => (
                          <span
                            key={appointment.id}
                            className={cn(
                              "truncate rounded-sm border border-l-4 px-1.5 py-0.5 text-xs font-medium shadow-2xs",
                              APPOINTMENT_STATUS_BORDER_CLASS[
                                appointment.status
                              ],
                              appointment.status === "CANCELLED"
                                ? "bg-muted text-muted-foreground line-through"
                                : "bg-card",
                            )}
                          >
                            <span className="tabular-nums font-semibold">
                              {formatMinute(
                                toLocalSlot(appointment.startsAt).minute,
                              )}
                            </span>{" "}
                            {appointment.patient.lastName}
                          </span>
                        ))}
                        {hasFreeBlocks ? (
                          <div
                            className={cn(
                              "flex flex-col",
                              hasAppointments ? "mt-auto pt-1" : "my-auto",
                            )}
                          >
                            <span className="inline-flex w-full items-center justify-center gap-1.5 rounded border-2 border-dashed border-primary/70 bg-primary-soft px-2 py-1 text-xs font-bold text-primary shadow-xs hover:border-primary">
                              <span className="inline-block size-1.5 rounded-full bg-primary" />
                              {freeLabel(item!, Boolean(query.serviceId))}
                            </span>
                          </div>
                        ) : (
                          <span className="mt-auto text-xs">
                            {status ? (
                              <span className="text-muted-foreground">
                                {status}
                              </span>
                            ) : day.date < today ? null : (
                              <span className="text-muted-foreground">
                                Sin bloques libres
                              </span>
                            )}
                          </span>
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
      <Legend freeClickable={false} />
    </div>
  );
}
