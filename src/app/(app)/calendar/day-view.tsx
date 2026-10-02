import Link from "next/link";
import { Ban } from "lucide-react";
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
import { PAYMENT_STATE_LABEL, type PaymentState } from "@/lib/payments";
import { PaymentStateIcon } from "@/components/payment-state-icon";
import { formatMinute, toLocalSlot } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { hourRange, type CalendarDay } from "./calendar-model";
import { NowLine } from "./now-line";

// Vista día del calendario del centro (HU-11): una columna por profesional.

const HOUR_HEIGHT = 96;
/// Carril para cancelados y vencidos, que no ocupan y pueden coincidir con un
/// turno nuevo o un bloque libre en el mismo horario.
const SIDE_LANE = "34%";
/// Alto mínimo de un bloque libre para mostrar su rótulo: una línea de
/// `text-xs` (16 px) más el borde y el padding (6 px). A 96 px por hora, 15 min.
const LABEL_MIN_HEIGHT = 22;
/// Horario de atención que ya pasó: gris de "fuera de horario" con rayado, para
/// distinguirlo de las horas en que el profesional no atiende.
const PAST =
  "bg-muted bg-[repeating-linear-gradient(135deg,var(--color-placeholder)_0_1.5px,transparent_1.5px_7px)]";

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
  paymentStates,
}: {
  day: CalendarDay;
  query: CalendarQuery;
  paymentStates: Record<number, PaymentState>;
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

  if (day.holiday) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-holiday/10 border-holiday/30 text-holiday-foreground flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center shadow-xs sm:p-14">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-holiday/40 bg-holiday/20 text-holiday-muted-foreground shadow-xs">
            <Ban aria-hidden="true" className="size-6" />
          </div>
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-holiday/40 bg-holiday/25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-holiday-muted-foreground">
            Centro cerrado
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-holiday-foreground sm:text-3xl">
            {day.holiday}
          </h2>
          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-holiday-muted-foreground/90 sm:text-base">
            El centro permanece cerrado todo el día: no se ofrecen turnos para
            ningún profesional.
          </p>
        </div>
        <Legend freeClickable />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {nobodyAttends && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Ningún profesional atiende este día</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "No hay profesionales con franja de atención ese día para los filtros elegidos."
                : "No hay profesionales con franja de atención ese día, o todos cargaron una ausencia."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {day.professionals.length > 0 && (
        // El contenedor scrollea en los dos ejes para que el encabezado y la
        // columna de horas queden fijos (sticky) con muchos profesionales.
        <div className="bg-card max-h-[calc(100svh-6rem)] overflow-auto rounded-lg border">
          <div
            className="grid gap-x-2 px-4 pb-4"
            style={{
              gridTemplateColumns: `3.5rem repeat(${day.professionals.length}, minmax(11rem, 1fr))`,
            }}
          >
            <div className="bg-card sticky top-0 left-0 z-40 -mr-2" />
            {day.professionals.map((item) => (
              <div
                key={item.professional.id}
                className="bg-card sticky top-0 z-30 flex flex-col gap-0.5 pt-4 pb-2"
              >
                <p className="text-label-md truncate uppercase">
                  {item.professional.lastName}, {item.professional.firstName}
                </p>
                <p className="truncate text-sm">
                  {item.absence ? (
                    <span className="text-muted-foreground">
                      Ausente: {item.absence}
                    </span>
                  ) : !item.windows.length ? (
                    <span className="text-muted-foreground">
                      Sin franja este día
                    </span>
                  ) : item.freeBlocks.length > 0 ? (
                    <span className="text-primary font-medium">
                      {item.freeBlocks.length}{" "}
                      {item.freeBlocks.length === 1
                        ? "bloque libre"
                        : "bloques libres"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Sin bloques libres
                    </span>
                  )}
                </p>
              </div>
            ))}

            <div
              className="bg-card sticky left-0 z-30 -mr-2"
              style={{ height }}
            >
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="text-label-sm text-muted-foreground absolute right-3.5 tabular-nums"
                  style={{ top: offset(hour * 60) }}
                >
                  {formatMinute(hour * 60)}
                </span>
              ))}
            </div>

            {day.professionals.map((item, column) => {
              const hasSideLane = item.appointments.some(
                (appointment) => !occupiesSlot(appointment.status),
              );
              const mainLane = hasSideLane
                ? { left: 0, right: SIDE_LANE }
                : { left: 0, right: 0 };
              return (
                <div
                  key={item.professional.id}
                  className="bg-muted border-border relative overflow-hidden rounded-md border transition-colors"
                  style={{ height }}
                >
                  {item.windows.map((window) => {
                    // La parte de la franja que ya pasó no acepta turnos: se
                    // sombrea para que no parezca un hueco libre.
                    const pastEnd = Math.min(
                      window.endMinute,
                      Math.max(window.startMinute, day.pastUntilMinute),
                    );
                    return (
                      <div
                        key={window.startMinute}
                        className={cn(
                          "absolute inset-x-0",
                          item.attends ? "bg-card" : "bg-muted",
                        )}
                        style={{
                          top: offset(window.startMinute),
                          height:
                            offset(window.endMinute) -
                            offset(window.startMinute),
                        }}
                      >
                        {item.attends && pastEnd > window.startMinute && (
                          <div
                            className={cn("absolute inset-x-0 top-0", PAST)}
                            style={{
                              height:
                                offset(pastEnd) - offset(window.startMinute),
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
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
                    const blockHeight = Math.max(
                      offset(block.endMinute) - offset(block.startMinute) - 2,
                      6,
                    );
                    // Un bloque corto (menos de ~15 min) no tiene lugar para el
                    // rótulo: queda como franja clickeable con el horario en
                    // el tooltip, en vez de mostrar el texto cortado.
                    const compact = blockHeight < LABEL_MIN_HEIGHT;
                    return (
                      <Link
                        key={block.startMinute}
                        href={newAppointmentHref(
                          query,
                          item.professional.id,
                          block.startMinute,
                        )}
                        aria-label={`Dar turno con ${item.professional.lastName} a las ${formatMinute(block.startMinute)} (libre ${label})`}
                        title={`Libre ${label} · dar turno en este horario`}
                        className={cn(
                          "border-primary/60 bg-primary-soft text-primary hover:bg-primary-soft/80 hover:border-primary focus-visible:ring-ring absolute overflow-hidden rounded-sm border-dashed text-xs leading-4 font-semibold shadow-xs outline-none transition-all focus-visible:ring-2",
                          compact ? "border" : "border-2 px-1.5 py-px",
                        )}
                        style={{
                          ...mainLane,
                          top: offset(block.startMinute) + 1,
                          height: blockHeight,
                        }}
                      >
                        {!compact && (
                          <>
                            <span className="font-bold">Libre</span>{" "}
                            <span className="tabular-nums">{label}</span>
                          </>
                        )}
                      </Link>
                    );
                  })}
                  <NowLine
                    date={query.date}
                    firstHour={firstHour}
                    lastHour={lastHour}
                    hourHeight={HOUR_HEIGHT}
                    withDot={column === 0}
                  />
                  {item.appointments.map((appointment) => {
                    const start = toLocalSlot(appointment.startsAt);
                    const end = toLocalSlot(appointment.endsAt);
                    const endMinute =
                      end.date === start.date ? end.minute : 1440;
                    const occupies = occupiesSlot(appointment.status);
                    const patient = `${appointment.patient.lastName}, ${appointment.patient.firstName}`;
                    const paymentState = paymentStates[appointment.id];
                    return (
                      <Link
                        key={appointment.id}
                        href={`/appointments/${appointment.id}?${detailSearch}`}
                        title={`${formatMinute(start.minute)} · ${patient} · ${appointment.service.name} · ${APPOINTMENT_STATUS_LABEL[appointment.status]}${appointment.priority === "URGENT" ? " · Urgente" : ""}${paymentState ? ` · ${PAYMENT_STATE_LABEL[paymentState]}` : ""}`}
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
                          {appointment.priority === "URGENT" && (
                            <span className="mr-1 inline-block rounded-xs border border-destructive-soft-border bg-destructive-soft px-1 py-0.2 text-[10px] font-semibold uppercase tracking-wider text-destructive-soft-foreground">
                              Urgente
                            </span>
                          )}
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
                        <span className="text-muted-foreground flex items-center gap-1 truncate">
                          {APPOINTMENT_STATUS_LABEL[appointment.status]}
                          {paymentState && (
                            <>
                              {" · "}
                              <PaymentStateIcon state={paymentState} />
                              <span className="truncate">
                                {PAYMENT_STATE_LABEL[paymentState]}
                              </span>
                            </>
                          )}
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
        <span className="border-primary/60 bg-primary-soft size-3.5 rounded-sm border-2 border-dashed" />
        {freeClickable ? "Bloque libre (clic para dar turno)" : "Bloque libre"}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="border-holiday/40 bg-holiday/25 size-3.5 rounded-sm border-2 border-dashed" />
        Centro cerrado (feriado o día excepcional)
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
      {freeClickable && (
        <li className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-sm border", PAST)} />
          Horario pasado
        </li>
      )}
    </ul>
  );
}
