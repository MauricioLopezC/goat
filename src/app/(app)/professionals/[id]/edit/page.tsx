import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DomainError } from "@/lib/actions";
import { requirePageRole } from "@/lib/dal/auth";
import {
  getProfessional,
  listActiveProfessionalTitles,
  listActiveServices,
} from "@/lib/dal/professionals";

import { ProfessionalEditor } from "../professional-editor";
import { FutureAppointmentCancel } from "../future-appointment-cancel";

export const metadata: Metadata = { title: "Modificar profesional · Goat" };

export default async function EditProfessionalPage({
  params,
}: PageProps<"/professionals/[id]/edit">) {
  const actor = await requirePageRole("MANAGER");
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

  const [titles, services] = await Promise.all([
    listActiveProfessionalTitles(actor),
    listActiveServices(actor),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg">
            Modificar a {professional.lastName}, {professional.firstName}
          </h1>
          <p className="text-muted-foreground">
            Actualizá sus datos o gestioná su estado.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/professionals/${professional.id}`}>Ver ficha</Link>
        </Button>
      </div>

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

      <Card id="future-appointments">
        <CardHeader>
          <CardTitle>
            Turnos programados ({professional.appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {professional.appointments.length ? (
            professional.appointments.map((appointment) => (
              <FutureAppointmentCancel
                key={appointment.id}
                appointmentId={appointment.id}
                professionalId={professional.id}
                description={`#${appointment.id} · ${appointment.startsAt.toLocaleString("es-AR")} · ${appointment.service.name} · ${appointment.patient.lastName}, ${appointment.patient.firstName} · ${professional.lastName}, ${professional.firstName}`}
              />
            ))
          ) : (
            <p className="text-muted-foreground">No hay turnos programados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
