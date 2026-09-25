import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Clock,
  CreditCard,
  Edit,
  Mail,
  Phone,
  Shield,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { canAccess } from "@/lib/route-access";
import { getPatient } from "@/lib/dal/patients";
import {
  GENDER_LABEL,
  COVERAGE_TYPE_LABEL,
  DOCUMENT_TYPE_LABEL,
  calculateAge,
} from "@/lib/patients";
import { CENTER_TIME_ZONE } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface PatientDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PatientDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Ficha de paciente #${id} · Goat`,
  };
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

const auditDateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: CENTER_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(date: Date | string) {
  const parts = auditDateFormatter.formatToParts(new Date(date));
  const p: Record<string, string> = {};
  for (const part of parts) {
    p[part.type] = part.value;
  }
  return `${p.day}/${p.month}/${p.year} a las ${p.hour}:${p.minute} hs`;
}

export default async function PatientDetailPage({
  params,
}: PatientDetailPageProps) {
  const actor = await requirePageRole(...STAFF_ROLES);
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

  const isManagerOrReceptionist =
    actor.role === "RECEPTIONIST" || actor.role === "MANAGER";
  const canBookAppointment = canAccess("/appointments/new", actor.role);

  const age = calculateAge(patient.birthDate);
  const isMinor = age < 16;

  return (
    <div className="flex flex-col gap-6">
      {/* Navegación y acciones superiores */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="size-8 p-0 shrink-0"
          >
            <Link href="/patients" title="Volver al listado de pacientes">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-display-lg font-bold tracking-tight text-foreground">
                {patient.lastName}, {patient.firstName}
              </h1>
              {patient.active ? (
                <Badge className="bg-success-soft text-success-soft-foreground border-success-soft-border rounded-lg text-xs font-medium gap-1">
                  <UserCheck className="size-3" />
                  Activo
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-muted-foreground rounded-lg text-xs font-medium gap-1"
                >
                  <UserX className="size-3" />
                  Inactivo
                </Badge>
              )}
            </div>
            <p className="text-body-md text-muted-foreground mt-0.5">
              <span className="font-mono font-medium text-foreground">
                {DOCUMENT_TYPE_LABEL[patient.documentType]}{" "}
                {patient.documentNumber}
              </span>{" "}
              · {age} {age === 1 ? "año" : "años"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {isManagerOrReceptionist && (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/patients/${patient.id}/edit`}>
                <Edit className="size-4" />
                Editar paciente
              </Link>
            </Button>
          )}
          {canBookAppointment && (
            <Button asChild className="gap-2">
              <Link href={`/appointments/new?patientId=${patient.id}`}>
                <CalendarPlus className="size-4" />
                Dar turno
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos Personales */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
              <User className="size-4 text-primary" />
              Datos personales
            </CardTitle>
            <CardDescription>
              Identificación y datos biográficos del paciente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-label-md text-muted-foreground uppercase">
                  Apellido
                </p>
                <p className="text-body-md font-medium text-foreground mt-0.5">
                  {patient.lastName}
                </p>
              </div>
              <div>
                <p className="text-label-md text-muted-foreground uppercase">
                  Nombre
                </p>
                <p className="text-body-md font-medium text-foreground mt-0.5">
                  {patient.firstName}
                </p>
              </div>
              <div>
                <p className="text-label-md text-muted-foreground uppercase">
                  Documento
                </p>
                <p className="text-body-md font-mono font-medium text-foreground mt-0.5">
                  {DOCUMENT_TYPE_LABEL[patient.documentType]}{" "}
                  {patient.documentNumber}
                </p>
              </div>
              <div>
                <p className="text-label-md text-muted-foreground uppercase">
                  Género
                </p>
                <p className="text-body-md font-medium text-foreground mt-0.5">
                  {GENDER_LABEL[patient.gender]}
                </p>
              </div>
              <div>
                <p className="text-label-md text-muted-foreground uppercase">
                  Fecha de nacimiento
                </p>
                <p className="text-body-md font-medium text-foreground mt-0.5 tabular-nums">
                  {formatDate(patient.birthDate)} ({age}{" "}
                  {age === 1 ? "año" : "años"})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacto */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
              <Phone className="size-4 text-primary" />
              Información de contacto
            </CardTitle>
            <CardDescription>
              Canales habilitados para avisos y turnos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div>
              <p className="text-label-md text-muted-foreground uppercase">
                Teléfono de contacto
              </p>
              <p className="text-body-md font-medium text-foreground mt-0.5 flex items-center gap-2">
                <Phone className="size-3.5 text-muted-foreground" />
                {patient.phone}
              </p>
            </div>
            <div>
              <p className="text-label-md text-muted-foreground uppercase">
                Correo electrónico
              </p>
              <p className="text-body-md font-medium text-foreground mt-0.5 flex items-center gap-2">
                <Mail className="size-3.5 text-muted-foreground" />
                {patient.email}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Responsable o Tutor */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
                <Shield className="size-4 text-primary" />
                Responsable o tutor
              </CardTitle>
              {isMinor && (
                <Badge
                  variant="secondary"
                  className="bg-info-soft text-info-soft-foreground border-info-soft-border text-xs rounded-lg font-medium"
                >
                  Menor de 16 años
                </Badge>
              )}
            </div>
            <CardDescription>
              {isMinor
                ? "Requerido obligatoriamente por ser menor de 16 años."
                : "Contacto de tutor o adulto responsable si fue provisto."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            {patient.guardianName ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-label-md text-muted-foreground uppercase">
                    Nombre del responsable
                  </p>
                  <p className="text-body-md font-medium text-foreground mt-0.5">
                    {patient.guardianName}
                  </p>
                </div>
                <div>
                  <p className="text-label-md text-muted-foreground uppercase">
                    Teléfono del responsable
                  </p>
                  <p className="text-body-md font-medium text-foreground mt-0.5">
                    {patient.guardianPhone ?? "No informado"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-body-sm text-muted-foreground italic">
                No se registró un tutor o responsable para este paciente.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Cobertura Médica */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
              <CreditCard className="size-4 text-primary" />
              Cobertura médica
            </CardTitle>
            <CardDescription>
              Modalidad de cobertura y datos de afiliación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div>
              <p className="text-label-md text-muted-foreground uppercase">
                Tipo de cobertura
              </p>
              <div className="mt-1">
                <Badge
                  variant="secondary"
                  className={
                    patient.coverageType === "HEALTH_INSURANCE"
                      ? "bg-primary-soft text-primary-soft-foreground border-primary-soft-border text-xs rounded-lg"
                      : "bg-tray text-foreground border-border text-xs rounded-lg"
                  }
                >
                  {COVERAGE_TYPE_LABEL[patient.coverageType]}
                </Badge>
              </div>
            </div>

            {patient.coverageType === "HEALTH_INSURANCE" && patient.coverage ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-label-md text-muted-foreground uppercase">
                    Obra social
                  </p>
                  <p className="text-body-md font-semibold text-foreground mt-0.5">
                    {patient.coverage.insurancePlan.healthInsurer.name}
                  </p>
                </div>
                <div>
                  <p className="text-label-md text-muted-foreground uppercase">
                    Plan
                  </p>
                  <p className="text-body-md font-medium text-foreground mt-0.5">
                    {patient.coverage.insurancePlan.name}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-label-md text-muted-foreground uppercase">
                    Número de afiliado
                  </p>
                  <p className="text-body-md font-mono font-medium text-foreground mt-0.5">
                    {patient.coverage.memberNumber}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-body-sm text-muted-foreground pt-1">
                Atención particular sin obra social asociada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bloque de Auditoría y Trazabilidad */}
      <Card className="rounded-xl border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-title-md flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" />
            Trazabilidad y auditoría
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-body-sm">
            <div>
              <p className="text-label-sm text-muted-foreground uppercase">
                Registrado por
              </p>
              <p className="text-body-sm text-foreground font-medium mt-0.5">
                {patient.createdBy.firstName} {patient.createdBy.lastName}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatDateTime(patient.createdAt)}
              </p>
            </div>
            {patient.updatedBy && (
              <div>
                <p className="text-label-sm text-muted-foreground uppercase">
                  Última modificación por
                </p>
                <p className="text-body-sm text-foreground font-medium mt-0.5">
                  {patient.updatedBy.firstName} {patient.updatedBy.lastName}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(patient.updatedAt)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
