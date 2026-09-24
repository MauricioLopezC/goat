import Link from "next/link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  APPOINTMENT_STATUS_BORDER_CLASS,
  APPOINTMENT_STATUS_LABEL,
  occupiesSlot,
} from "@/lib/appointment-status";
import { calendarSearch, type CalendarQuery } from "@/lib/calendar";
import { formatMinute, toLocalSlot } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { hourRange, type CalendarDay } from "./calendar-model";

// Vista día del calendario del centro (HU-11): una columna por profesional.

const HOUR_HEIGHT = 96;
/// Carril para cancelados y vencidos, que no ocupan y pueden coincidir con un
/// turno nuevo o un bloque libre en el mismo horario.
const SIDE_LANE = "34%";

function newAppointmentHref(
  query: CalendarQuery,
  professionalId: number,
  startMinute: number,
) {
  const search = new URLSearchParams({
    professionalId: String(professionalId),
    date: query.date,
    startTime: formatMinute(startMinute),
  });
  if (query.serviceId) search.set("serviceId", String(query.serviceId));
  return `/appointments/new?${search}`;
}

export function DayView({
  day,
  query,
}: {
  day: CalendarDay;
  query: CalendarQuery;
}) {
  const filtered = Boolean(query.professionalId || query.serviceId);
  const nobodyAttends = !day.professionals.some((item) => item.attends);
  const { firstHour, lastHour } = hourRange(day.professionals);
  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, index) => firstHour + index,
  );
  const height = hours.length * HOUR_HEIGHT;
  const offset = (minute: number) =>
    ((minute - firstHour * 60) / 60) * HOUR_HEIGHT;
  const detailSearch = calendarSearch(query);

  return (
    <div className="flex flex-col gap-4">
      {nobodyAttends && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              {day.holiday
                ? `Feriado: ${day.holiday}`
                : "Ningún profesional atiende este día"}
            </EmptyTitle>
            <EmptyDescription>
              {day.holiday
                ? "El centro no atiende en feriados."
                : filtered
                  ? "No hay profesionales con franja de atención ese día para los filtros elegidos."
                  : "No hay profesionales con franja de atención ese día, o todos cargaron una ausencia."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {day.professionals.length > 0 && (
        <div className="bg-card overflow-x-auto rounded-lg border p-4">
          <div
            className="grid gap-x-2"
            style={{
              gridTemplateColumns: `3.5rem repeat(${day.professionals.length}, minmax(11rem, 1fr))`,
            }}
          >
            <div />
            {day.professionals.map((item) => (
              <div
                key={item.professional.id}
                className="flex flex-col gap-0.5 pb-2"
              >
                <p className="text-label-md truncate uppercase">
                  {item.professional.lastName}, {item.professional.firstName}
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  {item.absence
                    ? `Ausente: ${item.absence}`
                    : day.holiday
                      ? "Feriado"
                      : !item.windows.length
                        ? "Sin franja este día"
                        : `${item.freeBlocks.length} ${item.freeBlocks.length === 1 ? "bloque libre" : "bloques libres"}`}
                </p>
              </div>
            ))}

            <div className="relative" style={{ height }}>
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="text-label-sm text-muted-foreground absolute right-1.5 tabular-nums"
                  style={{ top: offset(hour * 60) }}
                >
                  {formatMinute(hour * 60)}
                </span>
              ))}
            </div>

            {day.professionals.map((item) => {
              const hasSideLane = item.appointments.some(
                (appointment) => !occupiesSlot(appointment.status),
              );
              const mainLane = hasSideLane
                ? { left: 0, right: SIDE_LANE }
                : { left: 0, right: 0 };
              return (
                <div
                  key={item.professional.id}
                  className="bg-muted relative overflow-hidden rounded-md border"
                  style={{ height }}
                >
                  {item.windows.map((window) => (
                    <div
                      key={window.startMinute}
                      className={cn(
                        "absolute inset-x-0",
                        item.attends ? "bg-card" : "bg-muted",
                      )}
                      style={{
                        top: offset(window.startMinute),
                        height:
                          offset(window.endMinute) - offset(window.startMinute),
                      }}
                    />
                  ))}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-border pointer-events-none absolute inset-x-0 border-t"
                      style={{ top: offset(hour * 60) }}
                    />
                  ))}
                  {item.partialAbsences.map((absence) => (
                    <div
                      key={absence.startMinute}
                      title={`Ausencia: ${absence.reason}`}
                      className="bg-muted text-muted-foreground border-input absolute inset-x-1 overflow-hidden rounded-sm border border-dashed p-1 text-xs"
                      style={{
                        top: offset(absence.startMinute),
                        height:
                          offset(absence.endMinute) -
                          offset(absence.startMinute),
                      }}
                    >
                      Ausencia: {absence.reason}
                    </div>
                  ))}
                  {item.freeBlocks.map((block) => {
                    const label = `${formatMinute(block.startMinute)}–${formatMinute(block.endMinute)}`;
                    return (
                      <Link
                        key={block.startMinute}
                        href={newAppointmentHref(
                          query,
                          item.professional.id,
                          block.startMinute,
                        )}
                        aria-label={`Dar turno con ${item.professional.lastName} a las ${formatMinute(block.startMinute)}`}
                        title="Dar turno en este horario"
                        className="border-primary-soft-border bg-primary-soft/40 text-primary-soft-foreground hover:bg-primary-soft focus-visible:ring-ring absolute overflow-hidden rounded-sm border border-dashed px-1.5 py-0.5 text-xs outline-none focus-visible:ring-2"
                        style={{
                          ...mainLane,
                          top: offset(block.startMinute) + 1,
                          height: Math.max(
                            offset(block.endMinute) -
                              offset(block.startMinute) -
                              2,
                            12,
                          ),
                        }}
                      >
                        <span className="font-medium">Libre</span>{" "}
                        <span className="tabular-nums">{label}</span>
                      </Link>
                    );
                  })}
                  {item.appointments.map((appointment) => {
                    const start = toLocalSlot(appointment.startsAt);
                    const end = toLocalSlot(appointment.endsAt);
                    const endMinute =
                      end.date === start.date ? end.minute : 1440;
                    const occupies = occupiesSlot(appointment.status);
                    const patient = `${appointment.patient.lastName}, ${appointment.patient.firstName}`;
                    return (
                      <Link
                        key={appointment.id}
                        href={`/appointments/${appointment.id}?${detailSearch}`}
                        title={`${formatMinute(start.minute)} · ${patient} · ${appointment.service.name} · ${APPOINTMENT_STATUS_LABEL[appointment.status]}`}
                        className={cn(
                          "focus-visible:ring-ring absolute z-10 flex flex-col overflow-hidden rounded-sm border border-l-4 px-1.5 py-0.5 text-xs shadow-sm outline-none hover:shadow-md focus-visible:ring-2",
                          APPOINTMENT_STATUS_BORDER_CLASS[appointment.status],
                          appointment.status === "CANCELLED"
                            ? "bg-muted text-muted-foreground border-input"
                            : "bg-card",
                        )}
                        style={{
                          ...(occupies
                            ? mainLane
                            : { left: `calc(100% - ${SIDE_LANE})`, right: 0 }),
                          top: offset(start.minute) + 1,
                          height: Math.max(
                            offset(endMinute) - offset(start.minute) - 2,
                            12,
                          ),
                        }}
                      >
                        <span className="truncate">
                          <span className="font-semibold tabular-nums">
                            {formatMinute(start.minute)}
                          </span>{" "}
                          <span
                            className={cn(
                              "font-medium",
                              appointment.status === "CANCELLED" &&
                                "line-through",
                            )}
                          >
                            {patient}
                          </span>
                        </span>
                        <span className="text-muted-foreground truncate">
                          {appointment.service.name}
                        </span>
                        <span className="text-muted-foreground truncate">
                          {APPOINTMENT_STATUS_LABEL[appointment.status]}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Legend freeClickable />
    </div>
  );
}

export function Legend({ freeClickable }: { freeClickable: boolean }) {
  return (
    <ul
      aria-label="Referencias"
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm"
    >
      <li className="flex items-center gap-1.5">
        <span className="border-primary-soft-border bg-primary-soft/40 size-3 rounded-sm border border-dashed" />
        {freeClickable ? "Bloque libre (clic para dar turno)" : "Bloque libre"}
      </li>
      {(["SCHEDULED", "COMPLETED", "EXPIRED", "CANCELLED"] as const).map(
        (status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              className={cn(
                "bg-card size-3 rounded-sm border border-l-4",
                APPOINTMENT_STATUS_BORDER_CLASS[status],
              )}
            />
            {APPOINTMENT_STATUS_LABEL[status]}
          </li>
        ),
      )}
      <li className="flex items-center gap-1.5">
        <span className="bg-muted size-3 rounded-sm border" />
        Fuera de horario
      </li>
    </ul>
  );
}
