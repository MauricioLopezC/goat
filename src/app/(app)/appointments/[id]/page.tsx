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
  const { created } = await searchParams;
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
      </div>
    </>
  );
}
