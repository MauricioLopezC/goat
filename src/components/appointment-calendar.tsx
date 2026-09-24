import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { listAppointments } from "@/lib/dal/appointments";
import type { Actor } from "@/lib/dal/auth";
import { formatDate, formatMinute, toLocalSlot } from "@/lib/schedule";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Programado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
};

export async function AppointmentCalendar({
  date,
  actor,
}: {
  date: string;
  actor: Actor;
}) {
  const own = actor.role === "PROFESSIONAL";
  const appointments = await listAppointments(date, actor);
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-headline-lg">
          {own ? "Mi agenda" : "Calendario del centro"}
        </h1>
        {!own && (
          <Button asChild>
            <Link href="/appointments/new">Nuevo turno</Link>
          </Button>
        )}
      </header>
      <form
        action={own ? "/agenda" : "/calendar"}
        className="flex flex-wrap items-end gap-3"
      >
        <FieldGroup className="w-auto">
          <Field>
            <FieldLabel htmlFor="calendar-date">Fecha</FieldLabel>
            <Input
              id="calendar-date"
              type="date"
              name="date"
              defaultValue={date}
              required
              className="w-44 tabular-nums"
            />
          </Field>
        </FieldGroup>
        <Button type="submit" variant="outline">
          Ver día
        </Button>
      </form>
      <h2 className="text-headline-md">{formatDate(date)}</h2>
      <p className="text-muted-foreground">
        {own
          ? "Turnos de tu propia agenda."
          : "Turnos de todos los profesionales."}{" "}
        Horarios de Argentina.
      </p>
      {!appointments.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No hay turnos registrados para este día</EmptyTitle>
            <EmptyDescription>
              {own
                ? "Tus turnos aparecerán aquí cuando mesa de entradas los asigne."
                : "Podés asignar un turno desde Nuevo turno."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {appointments.map((appointment) => (
          <Card key={appointment.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="tabular-nums">
                  {formatMinute(toLocalSlot(appointment.startsAt).minute)}–
                  {formatMinute(toLocalSlot(appointment.endsAt).minute)}
                </span>
                <Badge variant="outline">
                  {APPOINTMENT_STATUS_LABEL[appointment.status]}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="font-medium">
                {appointment.patient.lastName}, {appointment.patient.firstName}
              </p>
              <p>{appointment.service.name}</p>
              <p className="text-muted-foreground">
                {appointment.professional.lastName},{" "}
                {appointment.professional.firstName}
              </p>
              <Button asChild variant="outline" className="self-start">
                <Link href={`/appointments/${appointment.id}`}>
                  Ver turno #{appointment.id}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
