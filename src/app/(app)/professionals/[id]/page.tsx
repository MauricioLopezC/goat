import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DomainError } from "@/lib/actions";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { getProfessional } from "@/lib/dal/professionals";

import { FutureAppointmentCancel } from "./future-appointment-cancel";

export const metadata: Metadata = { title: "Ficha profesional · Goat" };

const weekdays = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

function formatMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export default async function ProfessionalDetailPage({
  params,
}: PageProps<"/professionals/[id]">) {
  const actor = await requirePageRole(...STAFF_ROLES);
  const { id } = await params;
  const professionalId = Number(id);
  if (!Number.isSafeInteger(professionalId) || professionalId <= 0) notFound();

  let professional;
  try {
    professional = await getProfessional(professionalId, actor);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const manager = actor.role === "MANAGER";

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg">
            {professional.lastName}, {professional.firstName}
          </h1>
          <p className="text-muted-foreground">
            Matrícula {professional.licenseNumber} · {professional.documentType}{" "}
            {professional.documentNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {manager && (
            <Button asChild>
              <Link href={`/professionals/${professional.id}/edit`}>
                Modificar
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/professionals">Volver al listado</Link>
          </Button>
        </div>
      </div>

      <Badge
        variant={professional.active ? "secondary" : "destructive"}
        className={
          professional.active
            ? "bg-success-soft text-success-soft-foreground border-success-soft-border"
            : "bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border"
        }
      >
        {professional.active ? "Activo" : "Inactivo"}
      </Badge>

      <Card>
        <CardHeader>
          <CardTitle>Datos del profesional</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            <span className="font-medium">Documento:</span>{" "}
            {professional.documentType} {professional.documentNumber}
          </p>
          <p>
            <span className="font-medium">Matrícula:</span>{" "}
            {professional.licenseNumber}
          </p>
          <p>
            <span className="font-medium">Teléfono:</span>{" "}
            {professional.phone || "No informado"}
          </p>
          <p>
            <span className="font-medium">Correo:</span>{" "}
            {professional.email || "No informado"}
          </p>
          <p>
            <span className="font-medium">Títulos:</span>{" "}
            {professional.titles.map((title) => title.name).join(", ") ||
              "No informados"}
          </p>
          <p>
            <span className="font-medium">Servicios:</span>{" "}
            {professional.services.map((service) => service.name).join(", ") ||
              "No informados"}
          </p>
          <p>
            <span className="font-medium">Observaciones:</span>{" "}
            {professional.notes || "Sin observaciones"}
          </p>
          <p>
            <span className="font-medium">Registrado:</span>{" "}
            {professional.createdAt.toLocaleString("es-AR")}
          </p>
          <p>
            <span className="font-medium">Última actualización:</span>{" "}
            {professional.updatedAt.toLocaleString("es-AR")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agenda semanal</CardTitle>
        </CardHeader>
        <CardContent>
          {professional.availabilityWindows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este profesional todavía no tiene franjas de atención cargadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {professional.availabilityWindows.map((window) => (
                <li key={window.id} className="rounded-md border p-3 text-sm">
                  <span className="font-medium">
                    {weekdays[window.weekday]}
                  </span>
                  {": "}
                  {formatMinute(window.startMinute)}–
                  {formatMinute(window.endMinute)}
                  {window.room && ` · ${window.room.name}`}
                  {window.services.length > 0 &&
                    ` · ${window.services.map((service) => service.name).join(", ")}`}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card id="future-appointments">
        <CardHeader>
          <CardTitle>
            Turnos programados ({professional.appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {professional.appointments.length ? (
            professional.appointments.map((appointment) => {
              const description = `#${appointment.id} · ${appointment.startsAt.toLocaleString("es-AR")} · ${appointment.service.name} · ${appointment.patient.lastName}, ${appointment.patient.firstName} · ${professional.lastName}, ${professional.firstName}`;
              return manager ? (
                <FutureAppointmentCancel
                  key={appointment.id}
                  appointmentId={appointment.id}
                  professionalId={professional.id}
                  description={description}
                />
              ) : (
                <p key={appointment.id}>{description}</p>
              );
            })
          ) : (
            <p className="text-muted-foreground">No hay turnos programados.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de cambios</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {professional.events.length ? (
            professional.events.map((event) => (
              <div key={event.id} className="border-b border-border pb-2">
                <p>
                  {event.type === "UPDATED"
                    ? "Modificación"
                    : event.type === "DEACTIVATED"
                      ? "Baja"
                      : "Reactivación"}{" "}
                  · {event.createdAt.toLocaleString("es-AR")}
                </p>
                <p className="text-muted-foreground">
                  {event.user.firstName} {event.user.lastName} · Motivo:{" "}
                  {event.reason}
                </p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">
              Sin cambios posteriores al alta.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
