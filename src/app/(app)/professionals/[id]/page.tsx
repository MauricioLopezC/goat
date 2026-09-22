import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import {
  getProfessional,
  listActiveProfessionalTitles,
  listActiveServices,
} from "@/lib/dal/professionals";
import { DomainError } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfessionalEditor } from "./professional-editor";
import { FutureAppointmentCancel } from "./future-appointment-cancel";

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
  const [titles, services] = manager
    ? await Promise.all([
        listActiveProfessionalTitles(actor),
        listActiveServices(actor),
      ])
    : [[], []];
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
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
        <Button asChild variant="outline">
          <Link href="/professionals">Volver al listado</Link>
        </Button>
      </div>
      <Badge variant={professional.active ? "secondary" : "outline"}>
        {professional.active ? "Activo" : "Inactivo"}
      </Badge>
      {!manager && (
        <Card>
          <CardHeader>
            <CardTitle>Ficha profesional</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p>Teléfono: {professional.phone || "—"}</p>
            <p>Email: {professional.email || "—"}</p>
            <p>
              Títulos:{" "}
              {professional.titles.map((title) => title.name).join(", ")}
            </p>
            <p>
              Servicios:{" "}
              {professional.services.map((service) => service.name).join(", ")}
            </p>
            <p>Observaciones: {professional.notes || "—"}</p>
          </CardContent>
        </Card>
      )}
      {manager && (
        <ProfessionalEditor
          professional={{
            id: professional.id,
            firstName: professional.firstName,
            lastName: professional.lastName,
            documentType: professional.documentType,
            documentNumber: professional.documentNumber,
            licenseNumber: professional.licenseNumber,
            phone: professional.phone,
            email: professional.email,
            photoUrl: professional.photoUrl,
            notes: professional.notes,
            active: professional.active,
            deactivatedAt: professional.deactivatedAt?.toISOString() ?? null,
            titles: professional.titles,
            services: professional.services,
          }}
          titles={titles}
          services={services}
        />
      )}
      <Card id="future-appointments">
        <CardHeader>
          <CardTitle>
            Turnos futuros programados ({professional.appointments.length})
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
            <p className="text-muted-foreground">
              No hay turnos futuros programados.
            </p>
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
