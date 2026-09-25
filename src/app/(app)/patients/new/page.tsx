import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/dal/auth";
import { listHealthInsurers } from "@/lib/dal/patients";
import { Button } from "@/components/ui/button";
import { NewPatientForm } from "./NewPatientForm";

export const metadata: Metadata = {
  title: "Registrar paciente nuevo · Goat",
};

interface NewPatientPageProps {
  searchParams?: Promise<{ q?: string }>;
}

export default async function NewPatientPage({
  searchParams,
}: NewPatientPageProps) {
  // Solo RECEPCIONISTA y GERENTE pueden registrar pacientes (HU-07)
  const actor = await requirePageRole(Role.RECEPTIONIST, Role.MANAGER);

  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialQuery = resolvedParams?.q;

  const healthInsurers = await listHealthInsurers(actor);
  const cancelHref = "/patients";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="size-8 p-0 shrink-0"
        >
          <Link href={cancelHref} title="Volver a pacientes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-display-lg font-semibold tracking-tight text-foreground">
            Nuevo paciente
          </h1>
          <p className="text-body-lg text-muted-foreground mt-1">
            Alta rápida de paciente para asignación inmediata de turnos.
          </p>
        </div>
      </div>

      <NewPatientForm
        healthInsurers={healthInsurers}
        cancelHref={cancelHref}
        initialQuery={initialQuery}
      />
    </div>
  );
}
