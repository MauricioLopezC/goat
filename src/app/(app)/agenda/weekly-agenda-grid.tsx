"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Clock, FileText, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dateToDb,
  formatDate,
  formatMinute,
  toLocalSlot,
  WEEKDAY_LABEL,
} from "@/lib/schedule";
import type { AgendaAppointment, AgendaData } from "./agenda-types";

// Altura por hora compacta para que entre el día completo sin scroll con ruedita
const HOUR_HEIGHT = 48;

export function WeeklyAgendaGrid({ data }: { data: AgendaData }) {
  const [selectedAppointment, setSelectedAppointment] =
    useState<AgendaAppointment | null>(null);

  const todayDate = toLocalSlot(new Date()).date;

  const windowStartHours = data.windows.map((w) =>
    Math.floor(w.startMinute / 60),
  );
  const windowEndHours = data.windows.map((w) => Math.ceil(w.endMinute / 60));
  const apptStartHours = data.appointments.map((a) =>
    Math.floor(toLocalSlot(a.startsAt).minute / 60),
  );
  const apptEndHours = data.appointments.map((a) =>
    Math.ceil(toLocalSlot(a.endsAt).minute / 60),
  );

  const allStarts = [...windowStartHours, ...apptStartHours];
  const allEnds = [...windowEndHours, ...apptEndHours];

  const firstHour = allStarts.length > 0 ? Math.min(...allStarts) : 8;
  const lastHour = allEnds.length > 0 ? Math.max(...allEnds) : 18;

  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, index) => firstHour + index,
  );
  const height = hours.length * HOUR_HEIGHT;
  const offset = (minute: number) =>
    ((minute - firstHour * 60) / 60) * HOUR_HEIGHT;

  return (
    <>
      <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
        <div className="overflow-x-auto">
          <div className="grid min-w-[960px] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-x-2">
            {/* Cabecera: Eje de horas vacío */}
            <div className="pb-2" />

            {/* Cabeceras de días: Lunes a Domingo */}
            {data.week.days.map((day) => {
              const isToday = day.date === todayDate;
              const dateObj = dateToDb(day.date);
              const monthLabel = new Intl.DateTimeFormat("es-AR", {
                timeZone: "UTC",
                month: "short",
              }).format(dateObj);
              const holiday = data.holidays.find((h) => h.date === day.date);
              const dayExceptions = data.exceptions.filter(
                (e) => e.date === day.date,
              );
              const fullDayException = dayExceptions.find(
                (e) => e.startMinute === null || e.endMinute === null,
              );

              return (
                <div
                  key={day.date}
                  className={`pb-2 text-center transition-colors flex flex-col items-center justify-start ${
                    isToday
                      ? "bg-primary-soft/40 rounded-t-lg border-b-2 border-primary pt-1"
                      : ""
                  }`}
                >
                  <p className="text-label-md text-muted-foreground uppercase">
                    {WEEKDAY_LABEL[day.weekday]}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span
                      className={`text-body-sm font-semibold tabular-nums capitalize ${
                        isToday ? "text-primary font-bold" : "text-foreground"
                      }`}
                    >
                      {day.dayNumber} {monthLabel}
                    </span>
                    {isToday && (
                      <Badge
                        variant="outline"
                        className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 border-none font-medium"
                      >
                        Hoy
                      </Badge>
                    )}
                  </div>

                  {/* Feriado en la cabecera (sin pisar las franjas) */}
                  {holiday && (
                    <span
                      className="mt-1 w-full max-w-[130px] truncate rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200"
                      title={`Feriado: ${holiday.description}`}
                    >
                      Feriado: {holiday.description}
                    </span>
                  )}

                  {/* Ausencia de día completo en la cabecera */}
                  {!holiday && fullDayException && (
                    <span
                      className="mt-1 w-full max-w-[130px] truncate rounded bg-destructive/10 border border-destructive/25 px-1 py-0.5 text-[10px] font-semibold text-destructive"
                      title={`Ausencia: ${fullDayException.reason}`}
                    >
                      Ausencia: {fullDayException.reason}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Eje de horas lateral */}
            <div className="relative pt-1" style={{ height }}>
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="text-label-sm text-muted-foreground absolute right-1.5 -translate-y-1/2 tabular-nums"
                  style={{ top: offset(hour * 60) }}
                >
                  {formatMinute(hour * 60)}
                </span>
              ))}
            </div>

            {/* Columnas de cada uno de los 7 días */}
            {data.week.days.map((day) => {
              const dayWindows = data.windows.filter(
                (w) => w.weekday === day.weekday,
              );
              const dayAppointments = data.appointments.filter(
                (a) => toLocalSlot(a.startsAt).date === day.date,
              );
              const holiday = data.holidays.find((h) => h.date === day.date);
              const dayExceptions = data.exceptions.filter(
                (e) => e.date === day.date,
              );
              const fullDayException = dayExceptions.find(
                (e) => e.startMinute === null || e.endMinute === null,
              );
              const partialExceptions = dayExceptions.filter(
                (e) => e.startMinute !== null && e.endMinute !== null,
              );

              return (
                <div
                  key={day.date}
                  className="bg-muted/30 border-border relative rounded-lg border pt-1"
                  style={{ height }}
                >
                  {/* Líneas tenues separadoras de cada hora */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-border/40 pointer-events-none absolute inset-x-0 border-t"
                      style={{ top: offset(hour * 60) }}
                    />
                  ))}

                  {/* Ausencias / Excepciones parciales por hora */}
                  {partialExceptions.map((exc) => (
                    <div
                      key={exc.id}
                      className="bg-destructive-soft border-destructive-soft-border text-destructive-soft-foreground absolute inset-x-1 z-15 overflow-hidden rounded border p-1 text-[11px] font-medium"
                      style={{
                        top: offset(exc.startMinute!),
                        height: Math.max(
                          offset(exc.endMinute!) - offset(exc.startMinute!),
                          24,
                        ),
                      }}
                      title={`Ausencia: ${exc.reason}`}
                    >
                      Ausencia ({formatMinute(exc.startMinute!)}–
                      {formatMinute(exc.endMinute!)}): {exc.reason}
                    </div>
                  ))}

                  {/* Franjas horarias de atención del profesional (Rectángulos base) */}
                  {dayWindows.map((window) => {
                    const isClosed = Boolean(holiday || fullDayException);
                    // El rótulo de la franja arranca después de las ausencias
                    // que tapan su inicio, para no quedar debajo de ellas
                    let labelMinute = window.startMinute;
                    for (const exc of [...partialExceptions].sort(
                      (a, b) => a.startMinute! - b.startMinute!,
                    )) {
                      if (
                        exc.startMinute! <= labelMinute &&
                        exc.endMinute! > labelMinute
                      ) {
                        labelMinute = exc.endMinute!;
                      }
                    }
                    const labelVisible = labelMinute < window.endMinute;

                    return (
                      <div
                        key={window.id}
                        className={`pointer-events-none absolute inset-x-0.5 flex flex-col justify-between overflow-hidden rounded-lg border-2 border-dashed p-1.5 ${
                          isClosed
                            ? "border-muted-foreground/30 bg-muted/40 text-muted-foreground opacity-50"
                            : "border-primary/40 bg-primary-soft/30 text-primary-soft-foreground"
                        }`}
                        style={{
                          top: offset(window.startMinute),
                          height:
                            offset(window.endMinute) -
                            offset(window.startMinute),
                        }}
                      >
                        <div
                          className={`flex flex-col ${labelVisible ? "" : "hidden"}`}
                          style={{
                            marginTop:
                              offset(labelMinute) - offset(window.startMinute),
                          }}
                        >
                          <span
                            className={`font-semibold tabular-nums text-[10px] uppercase ${
                              isClosed
                                ? "text-muted-foreground"
                                : "text-primary"
                            }`}
                          >
                            {window.room ? `${window.room.name} · ` : ""}
                            {formatMinute(window.startMinute)}–
                            {formatMinute(window.endMinute)}
                          </span>
                          <span className="text-[10px] truncate opacity-80">
                            {isClosed
                              ? holiday
                                ? "Sin atención (Feriado)"
                                : "Sin atención (Ausencia)"
                              : window.services.length
                                ? window.services.map((s) => s.name).join(", ")
                                : "Todos sus servicios"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Bloques de Turnos: claros, limpios y clickeables */}
                  {dayAppointments.map((appointment) => {
                    const startMinute = toLocalSlot(
                      appointment.startsAt,
                    ).minute;
                    const endMinute = toLocalSlot(appointment.endsAt).minute;
                    const top = offset(startMinute);
                    const rawHeight = offset(endMinute) - offset(startMinute);
                    const cardHeight = Math.max(rawHeight - 1, 24);

                    const isCancelled = appointment.status === "CANCELLED";
                    const isCompleted = appointment.status === "COMPLETED";

                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => setSelectedAppointment(appointment)}
                        title={`Clic para ver turno: ${appointment.patient.lastName}, ${appointment.patient.firstName}`}
                        className={`group absolute inset-x-0.5 flex items-center justify-between overflow-hidden rounded border border-l-4 px-1.5 py-0.5 text-left text-xs transition-all hover:scale-[1.01] hover:shadow-xs cursor-pointer ${
                          // Opaco para tapar el rótulo de la franja; debajo de
                          // los turnos activos si el horario se volvió a dar
                          isCancelled
                            ? "z-19 border-border border-l-destructive bg-muted text-muted-foreground line-through"
                            : isCompleted
                              ? "z-20 border-border border-l-emerald-600 bg-card text-foreground shadow-2xs hover:border-emerald-600"
                              : "z-20 border-border border-l-primary bg-card text-foreground shadow-2xs hover:border-primary"
                        }`}
                        style={{
                          top,
                          height: cardHeight,
                        }}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden w-full">
                          <span
                            className={`font-bold tabular-nums text-[11px] shrink-0 ${isCancelled ? "" : "text-foreground"}`}
                          >
                            {formatMinute(startMinute)}–
                            {formatMinute(endMinute)}
                          </span>
                          <span
                            className={`font-medium text-[11px] truncate ${isCancelled ? "" : "text-foreground/90"}`}
                          >
                            {appointment.patient.lastName},{" "}
                            {appointment.patient.firstName}
                          </span>
                        </div>
                        <span
                          className={`size-1.5 rounded-full shrink-0 ml-1 ${
                            isCancelled
                              ? "bg-destructive"
                              : isCompleted
                                ? "bg-emerald-600"
                                : "bg-primary"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal interactivo con los datos del turno en concreto */}
      {selectedAppointment && (
        <Dialog
          open={Boolean(selectedAppointment)}
          onOpenChange={(open) => {
            if (!open) setSelectedAppointment(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 mr-6">
                <DialogTitle className="text-title-md flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  Detalle del turno #{selectedAppointment.id}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className={
                    selectedAppointment.status === "CANCELLED"
                      ? "bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border"
                      : selectedAppointment.status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-primary-soft text-primary-soft-foreground border-primary-soft-border"
                  }
                >
                  {selectedAppointment.status === "CANCELLED"
                    ? "Cancelado"
                    : selectedAppointment.status === "COMPLETED"
                      ? "Completado"
                      : "Programado"}
                </Badge>
              </div>
              <DialogDescription>
                Información del paciente y servicio asignado para esta consulta.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-2 text-sm">
              {/* Fecha y Horario */}
              <div className="bg-muted/50 rounded-lg p-3 flex flex-col gap-1 border border-border/60">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="capitalize">
                    {formatDate(toLocalSlot(selectedAppointment.startsAt).date)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-xs pl-6">
                  <span className="font-bold text-foreground tabular-nums">
                    {formatMinute(
                      toLocalSlot(selectedAppointment.startsAt).minute,
                    )}{" "}
                    a{" "}
                    {formatMinute(
                      toLocalSlot(selectedAppointment.endsAt).minute,
                    )}
                  </span>
                  <span>
                    (
                    {toLocalSlot(selectedAppointment.endsAt).minute -
                      toLocalSlot(selectedAppointment.startsAt).minute}{" "}
                    minutos)
                  </span>
                </div>
              </div>

              {/* Paciente */}
              <div className="flex flex-col gap-1 border-b border-border/50 pb-2.5">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
                  <User className="size-3.5" />
                  Paciente
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground text-base">
                      {selectedAppointment.patient.lastName},{" "}
                      {selectedAppointment.patient.firstName}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {selectedAppointment.patient.documentType}{" "}
                      {selectedAppointment.patient.documentNumber}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/patients/${selectedAppointment.patient.id}`}>
                      Ver paciente
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Servicio */}
              <div className="flex flex-col gap-1 border-b border-border/50 pb-2.5">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  Servicio
                </span>
                <p className="font-semibold text-foreground">
                  {selectedAppointment.service.name}
                </p>
              </div>

              {/* Notas u observaciones */}
              {selectedAppointment.notes && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Observaciones
                  </span>
                  <p className="bg-muted/40 rounded p-2 text-xs text-muted-foreground italic">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cerrar
                </Button>
              </DialogClose>
              <Button asChild size="sm">
                <Link href={`/appointments/${selectedAppointment.id}`}>
                  Ver turno completo #{selectedAppointment.id}
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
