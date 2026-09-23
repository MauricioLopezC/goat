import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WeeklySchedule } from "@/components/weekly-schedule";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DomainError } from "@/lib/actions";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { getProfessionalSchedule } from "@/lib/dal/availability";

import { ExceptionsSection } from "./exceptions-section";
import { ScheduleEditor } from "./schedule-editor";

export const metadata: Metadata = { title: "Agenda del profesional · Goat" };

export default async function ProfessionalSchedulePage({
  params,
}: PageProps<"/professionals/[id]/schedule">) {
  // HU-05: MANAGER carga y modifica; RECEPTIONIST consulta; PROFESSIONAL
  // consulta solo la suya (lo verifica la DAL).
  const actor = await requirePageRole(...STAFF_ROLES);
  const { id } = await params;
  const professionalId = Number(id);
  if (!Number.isSafeInteger(professionalId) || professionalId <= 0) notFound();

  let schedule;
  try {
    schedule = await getProfessionalSchedule(professionalId, actor);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    if (error instanceof DomainError && error.code === "FORBIDDEN")
      return (
        <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border max-w-xl">
          <AlertDescription className="text-destructive-soft-foreground">
            Solo podés consultar tu propia agenda.
          </AlertDescription>
        </Alert>
      );
    throw error;
  }

  const { professional, windows, exceptions, services, rooms } = schedule;
  const manager = actor.role === "MANAGER";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg">
            Agenda de {professional.lastName}, {professional.firstName}
          </h1>
          <p className="text-muted-foreground">
            Franjas de atención semanales y ausencias puntuales.
          </p>
          {!professional.active && (
            <Badge className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border w-fit">
              Inactivo
            </Badge>
          )}
        </div>
        <Button asChild variant="outline">
          <Link href={`/professionals/${professional.id}`}>
            Volver a la ficha
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Franjas semanales</CardTitle>
        </CardHeader>
        <CardContent>
          {manager ? (
            <ScheduleEditor
              professionalId={professional.id}
              active={professional.active}
              windows={windows}
              services={services}
              rooms={rooms}
            />
          ) : (
            <WeeklySchedule windows={windows} />
          )}
        </CardContent>
      </Card>

      <ExceptionsSection
        professionalId={professional.id}
        exceptions={exceptions}
        canEdit={manager}
      />
    </div>
  );
}
