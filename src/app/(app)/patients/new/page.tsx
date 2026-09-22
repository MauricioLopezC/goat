import { Metadata } from "next";
import { Role } from "@/generated/prisma/enums";
import { landingPath, requirePageRole } from "@/lib/dal/auth";
import { listHealthInsurers } from "@/lib/dal/patients";
import { NewPatientForm } from "./NewPatientForm";

export const metadata: Metadata = {
  title: "Registrar paciente nuevo · Goat",
};

export default async function NewPatientPage() {
  // Solo RECEPCIONISTA y GERENTE pueden registrar pacientes (HU-07)
  const actor = await requirePageRole(Role.RECEPTIONIST, Role.MANAGER);

  const healthInsurers = await listHealthInsurers(actor);
  const cancelHref = landingPath(actor.role);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-display-lg font-semibold tracking-tight text-foreground">
          Nuevo paciente
        </h1>
        <p className="text-body-lg text-muted-foreground mt-1">
          Alta rápida de paciente para asignación inmediata de turnos.
        </p>
      </div>

      <NewPatientForm healthInsurers={healthInsurers} cancelHref={cancelHref} />
    </div>
  );
}
