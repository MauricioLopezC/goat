import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/dal/auth";
import { getPatient, listHealthInsurers } from "@/lib/dal/patients";
import { Button } from "@/components/ui/button";
import { EditPatientForm, type PatientInitialData } from "./EditPatientForm";

interface EditPatientPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditPatientPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Editar paciente #${id} · Goat`,
  };
}

function toDateInputValue(d: Date | string) {
  const date = new Date(d);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function EditPatientPage({
  params,
}: EditPatientPageProps) {
  // Solo RECEPCIONISTA y GERENTE pueden modificar datos de pacientes (HU-08)
  const actor = await requirePageRole(Role.RECEPTIONIST, Role.MANAGER);
  const { id: rawId } = await params;
  const patientId = Number(rawId);

  if (isNaN(patientId) || patientId <= 0) {
    notFound();
  }

  let patient;
  try {
    patient = await getPatient(patientId, actor);
  } catch {
    notFound();
  }

  const healthInsurers = await listHealthInsurers(actor);
  const cancelHref = `/patients/${patient.id}`;

  const initialPatient: PatientInitialData = {
    id: patient.id,
    lastName: patient.lastName,
    firstName: patient.firstName,
    gender: patient.gender,
    documentType: patient.documentType,
    documentNumber: patient.documentNumber,
    birthDate: toDateInputValue(patient.birthDate),
    phone: patient.phone,
    email: patient.email,
    coverageType: patient.coverageType,
    guardianName: patient.guardianName,
    guardianPhone: patient.guardianPhone,
    healthInsurerId: patient.coverage?.insurancePlan.healthInsurerId,
    insurancePlanId: patient.coverage?.insurancePlanId,
    memberNumber: patient.coverage?.memberNumber,
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="size-8 p-0 shrink-0"
        >
          <Link href={cancelHref} title="Volver a la ficha">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-display-lg font-semibold tracking-tight text-foreground">
            Editar paciente
          </h1>
          <p className="text-body-lg text-muted-foreground mt-1">
            Modificación de datos personales, contacto y cobertura médica.
          </p>
        </div>
      </div>

      <EditPatientForm
        initialPatient={initialPatient}
        healthInsurers={healthInsurers}
        cancelHref={cancelHref}
      />
    </div>
  );
}
