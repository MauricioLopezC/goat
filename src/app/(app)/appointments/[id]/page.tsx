import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/dal/auth";
import { getAppointment } from "@/lib/dal/appointments";
import { DomainError } from "@/lib/actions";
import {
  formatDate,
  formatMinute,
  formatInstant,
  toLocalSlot,
} from "@/lib/schedule";
import { APPOINTMENT_STATUS_LABEL } from "@/components/appointment-calendar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CancelAppointmentDialog } from "./cancel-dialog";
import type { AppointmentEventType } from "@/generated/prisma/enums";

const EVENT_TYPE_LABEL: Record<AppointmentEventType, string> = {
  UPDATED: "Modificado",
  CANCELLED: "Cancelado",
  COMPLETED: "Completado",
  EXPIRED: "Vencido",
};

export default async function AppointmentPage({
  params,
  searchParams,
}: PageProps<"/appointments/[id]">) {
  const actor = await requirePageRole(
    "RECEPTIONIST",
    "MANAGER",
    "PROFESSIONAL",
  );
  const { id } = await params;
  const { created, cancelled } = await searchParams;
  let appointment;
  try {
    appointment = await getAppointment(Number(id), actor);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const start = toLocalSlot(appointment.startsAt);
  const end = toLocalSlot(appointment.endsAt);
  const own = actor.role === "PROFESSIONAL";
  const canCancel =
    !own &&
    appointment.status === "SCHEDULED" &&
    (actor.role === "RECEPTIONIST" || actor.role === "MANAGER");

  const cancelSummary = canCancel
    ? `${appointment.patient.lastName}, ${appointment.patient.firstName} · ${appointment.professional.lastName}, ${appointment.professional.firstName} · ${appointment.service.name} · ${formatDate(start.date)}, ${formatMinute(start.minute)}–${formatMinute(end.minute)}`
    : "";

  return (
    <>
      <h1 className="text-headline-lg">Turno #{appointment.id}</h1>
      {created === "1" && !own && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>Turno registrado correctamente</AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            El horario quedó reservado y ya aparece en el calendario y en la
            agenda del profesional.
          </AlertDescription>
        </Alert>
      )}
      {cancelled === "1" && !own && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>Turno cancelado exitosamente</AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            El turno #{appointment.id} fue cancelado y el horario quedó liberado
            de inmediato.
          </AlertDescription>
        </Alert>
      )}
      {appointment.status === "CANCELLED" && cancelled !== "1" && (
        <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border">
          <AlertTitle>Turno cancelado</AlertTitle>
          <AlertDescription className="text-destructive-soft-foreground">
            Este turno fue cancelado. El horario quedó disponible.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{APPOINTMENT_STATUS_LABEL[appointment.status]}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Paciente</dt>
              <dd>
                {appointment.patient.lastName}, {appointment.patient.firstName}{" "}
                · {appointment.patient.documentType}{" "}
                {appointment.patient.documentNumber}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Servicio</dt>
              <dd>{appointment.service.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Profesional</dt>
              <dd>
                {appointment.professional.lastName},{" "}
                {appointment.professional.firstName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Día</dt>
              <dd>{formatDate(start.date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Horario (Argentina)</dt>
              <dd className="tabular-nums">
                {formatMinute(start.minute)}–{formatMinute(end.minute)}
                {end.date !== start.date ? " del día siguiente" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Duración</dt>
              <dd>
                {(appointment.endsAt.getTime() -
                  appointment.startsAt.getTime()) /
                  60_000}{" "}
                minutos
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Registrado por</dt>
              <dd>
                {appointment.createdBy.lastName},{" "}
                {appointment.createdBy.firstName} ·{" "}
                {formatInstant(appointment.createdAt)}
              </dd>
            </div>
            {appointment.notes && (
              <div>
                <dt className="text-muted-foreground">Observación</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {appointment.notes}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
      {appointment.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {appointment.events.map((event) => (
                <li key={event.id} className="flex flex-col gap-0.5 text-sm">
                  <p className="font-medium">
                    {EVENT_TYPE_LABEL[event.type]} ·{" "}
                    {formatInstant(event.createdAt)}
                  </p>
                  <p className="text-muted-foreground">
                    Por: {event.user.lastName}, {event.user.firstName}
                  </p>
                  {event.reason && (
                    <p className="text-muted-foreground">
                      Motivo: {event.reason}
                    </p>
                  )}
                  {event.requestedBy && (
                    <p className="text-muted-foreground">
                      Solicitó: {event.requestedBy}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Alert>
        <AlertTitle>Email al paciente: PENDIENTE</AlertTitle>
        <AlertDescription>
          El envío de avisos por correo todavía no está implementado. No se
          envió un email al registrar este turno.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`${own ? "/agenda" : "/calendar"}?date=${start.date}`}>
            {own ? "Volver a mi agenda" : "Volver al calendario"}
          </Link>
        </Button>
        {!own && (
          <Button asChild>
            <Link href="/appointments/new">Dar otro turno</Link>
          </Button>
        )}
        {canCancel && (
          <CancelAppointmentDialog
            appointmentId={appointment.id}
            summary={cancelSummary}
          />
        )}
      </div>
    </>
  );
}
