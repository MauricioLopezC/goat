import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  formatDate,
  formatMinute,
  toLocalSlot,
  WEEKDAY_LABEL,
} from "@/lib/schedule";
import type { AgendaData } from "./agenda-types";

const HOUR_HEIGHT = 64;

export function DailyAgendaList({ data }: { data: AgendaData }) {
  const selectedDate = data.date;
  const daySlot = toLocalSlot(new Date(`${selectedDate}T12:00:00-03:00`));
  const weekday = daySlot.weekday;

  const dayWindows = data.windows.filter((w) => w.weekday === weekday);
  const dayAppointments = data.appointments.filter(
    (a) => toLocalSlot(a.startsAt).date === selectedDate,
  );
  const holiday = data.holidays.find((h) => h.date === selectedDate);
  const exceptions = data.exceptions.filter((e) => e.date === selectedDate);

  const windowStartHours = dayWindows.map((w) =>
    Math.floor(w.startMinute / 60),
  );
  const windowEndHours = dayWindows.map((w) => Math.ceil(w.endMinute / 60));
  const apptStartHours = dayAppointments.map((a) =>
    Math.floor(toLocalSlot(a.startsAt).minute / 60),
  );
  const apptEndHours = dayAppointments.map((a) =>
    Math.ceil(toLocalSlot(a.endsAt).minute / 60),
  );

  const firstHour = Math.min(8, ...windowStartHours, ...apptStartHours);
  const lastHour = Math.max(20, ...windowEndHours, ...apptEndHours);

  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, index) => firstHour + index,
  );
  const height = hours.length * HOUR_HEIGHT;
  const offset = (minute: number) =>
    ((minute - firstHour * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12">
      {/* Columna izquierda: Timeline visual del día (4 columnas en pantallas grandes) */}
      <div className="bg-card border-border rounded-xl border p-4 shadow-xs lg:col-span-4">
        <h3 className="text-title-sm font-semibold mb-3">
          Franjas horarias y cronograma
        </h3>
        <p className="text-muted-foreground text-xs mb-3">
          {WEEKDAY_LABEL[weekday]} {formatDate(selectedDate)}
        </p>

        {holiday && (
          <div className="bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200 mb-3 rounded-lg border p-2 text-xs font-medium">
            Feriado: {holiday.description}
          </div>
        )}

        {exceptions.map((exc) => (
          <div
            key={exc.id}
            className="bg-destructive/10 border-destructive/30 text-destructive mb-3 rounded-lg border p-2 text-xs font-medium"
          >
            Ausencia: {exc.reason}{" "}
            {exc.startMinute !== null &&
              exc.endMinute !== null &&
              `(${formatMinute(exc.startMinute)}–${formatMinute(exc.endMinute)})`}
          </div>
        ))}

        <div className="grid grid-cols-[3rem_1fr] gap-x-2">
          {/* Eje de horas */}
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

          {/* Columna del día */}
          <div
            className="bg-muted/30 border-border relative rounded-lg border"
            style={{ height }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-border/40 pointer-events-none absolute inset-x-0 border-t"
                style={{ top: offset(hour * 60) }}
              />
            ))}

            {/* Franjas del profesional */}
            {dayWindows.map((window) => (
              <div
                key={window.id}
                className="border-primary/40 bg-primary-soft/35 text-primary-soft-foreground absolute inset-x-1 flex flex-col justify-between overflow-hidden rounded-lg border-2 border-dashed p-1.5"
                style={{
                  top: offset(window.startMinute),
                  height: offset(window.endMinute) - offset(window.startMinute),
                }}
              >
                <p className="font-semibold text-primary tabular-nums text-xs">
                  {window.room ? `${window.room.name} · ` : ""}
                  {formatMinute(window.startMinute)}–
                  {formatMinute(window.endMinute)}
                </p>
                <p className="text-muted-foreground text-[10px] truncate">
                  {window.services.length
                    ? window.services.map((s) => s.name).join(", ")
                    : "Todos sus servicios"}
                </p>
              </div>
            ))}

            {/* Turnos en el timeline */}
            {dayAppointments.map((appointment) => {
              const startMinute = toLocalSlot(appointment.startsAt).minute;
              const endMinute = toLocalSlot(appointment.endsAt).minute;
              const top = offset(startMinute);
              const cardHeight = Math.max(
                offset(endMinute) - offset(startMinute) - 2,
                48,
              );
              const isCancelled = appointment.status === "CANCELLED";
              const isCompleted = appointment.status === "COMPLETED";

              return (
                <div
                  key={appointment.id}
                  className={`absolute inset-x-1 z-25 flex flex-col justify-between rounded-md border p-1.5 text-xs shadow-xs ${
                    isCancelled
                      ? "bg-card/90 text-muted-foreground border-border border-l-destructive line-through opacity-75 border-l-4"
                      : isCompleted
                        ? "bg-card text-foreground border-border border-l-emerald-600 border-l-4"
                        : "bg-card text-foreground border-border border-l-primary border-l-4"
                  }`}
                  style={{ top, height: cardHeight }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold tabular-nums text-[11px]">
                      {formatMinute(startMinute)}–{formatMinute(endMinute)}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {appointment.patient.lastName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Columna derecha: Lista detallada de turnos (8 columnas en pantallas grandes) */}
      <div className="flex flex-col gap-4 lg:col-span-8">
        <div className="flex items-center justify-between">
          <h3 className="text-headline-sm font-semibold">
            Turnos del día ({dayAppointments.length})
          </h3>
        </div>

        {dayAppointments.length === 0 ? (
          <Empty className="bg-card border-border rounded-xl border p-8">
            <EmptyHeader>
              <EmptyTitle>No hay turnos registrados para este día</EmptyTitle>
              <EmptyDescription>
                Tus turnos asignados para esta fecha aparecerán aquí cuando mesa
                de entradas los programe.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {dayAppointments.map((appointment) => {
              const startMinute = toLocalSlot(appointment.startsAt).minute;
              const endMinute = toLocalSlot(appointment.endsAt).minute;
              const isCancelled = appointment.status === "CANCELLED";
              const isCompleted = appointment.status === "COMPLETED";

              return (
                <Card
                  key={appointment.id}
                  className={`overflow-hidden border transition-shadow hover:shadow-md ${
                    isCancelled
                      ? "border-destructive/30 bg-muted/20 opacity-80"
                      : isCompleted
                        ? "border-emerald-200 dark:border-emerald-800"
                        : "border-border"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="font-bold tabular-nums text-base">
                        {formatMinute(startMinute)}–{formatMinute(endMinute)}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          isCancelled
                            ? "bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border"
                            : isCompleted
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-primary-soft text-primary-soft-foreground border-primary-soft-border"
                        }
                      >
                        {isCancelled
                          ? "Cancelado"
                          : isCompleted
                            ? "Completado"
                            : "Programado"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div>
                      <p className="text-title-sm font-semibold text-foreground">
                        {appointment.patient.lastName},{" "}
                        {appointment.patient.firstName}
                      </p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {appointment.patient.documentType}{" "}
                        {appointment.patient.documentNumber}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Servicio</p>
                      <p className="text-body-sm font-medium text-foreground">
                        {appointment.service.name}
                      </p>
                    </div>

                    {appointment.notes && (
                      <div className="bg-muted/50 rounded p-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Notas:{" "}
                        </span>
                        {appointment.notes}
                      </div>
                    )}

                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/appointments/${appointment.id}`}>
                          Ver turno #{appointment.id}
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/patients/${appointment.patient.id}`}>
                          Ver paciente
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
