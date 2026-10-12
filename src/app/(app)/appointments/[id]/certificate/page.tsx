import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo-goat.png";
import { requirePageRole } from "@/lib/dal/auth";
import { getAttendanceCertificate } from "@/lib/dal/appointments";
import { Role } from "@/generated/prisma/enums";
import { DomainError } from "@/lib/actions";
import { formatDate, formatMinute, toLocalSlot } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = {
  title: "Constancia de atención · Goat",
};

export default async function AttendanceCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    notFound();
  }

  const actor = await requirePageRole(Role.RECEPTIONIST, Role.MANAGER);

  let cert;
  try {
    cert = await getAttendanceCertificate(appointmentId, actor);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const apptStart = toLocalSlot(cert.startsAt);
  const apptEnd = toLocalSlot(cert.endsAt);
  const todaySlot = toLocalSlot(new Date());

  const coverageLabel =
    cert.patient.coverageType === "PRIVATE"
      ? "Particular"
      : `${cert.patient.healthInsurer ?? "Obra social"}${
          cert.patient.healthPlan ? ` · ${cert.patient.healthPlan}` : ""
        }${
          cert.patient.affiliateNumber
            ? ` (Nº ${cert.patient.affiliateNumber})`
            : ""
        }`;

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de navegación superior (no imprimible) */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/appointments/${cert.appointmentId}`}>
              <ArrowLeft className="size-4" />
              Volver al turno #{cert.appointmentId}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/today">Turnos de hoy</Link>
          </Button>
        </div>
        <PrintButton />
      </div>

      {/* Documento / Constancia listo para hoja A4 */}
      <div className="mx-auto w-full max-w-2xl rounded-lg border bg-card p-6 shadow-xs text-foreground md:p-8 print:border-none print:p-0 print:shadow-none print:max-w-none">
        {/* Encabezado institucional del centro */}
        <div className="flex flex-col items-center border-b pb-6 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <Image
              src={logo}
              width={48}
              height={48}
              alt={cert.center.name}
              className="size-12 shrink-0 rounded-xl"
              priority
            />
            <div>
              <h1 className="text-headline-md font-bold text-foreground">
                {cert.center.name}
              </h1>
              <p className="text-body-sm text-muted-foreground">
                {cert.center.legalName}
              </p>
            </div>
          </div>
          <div className="mt-3 text-right text-xs text-muted-foreground sm:mt-0">
            <p className="font-semibold text-foreground">
              CUIT {cert.center.cuit}
            </p>
            <p>{cert.center.address}</p>
            <p>Tel: {cert.center.phone}</p>
            <p>{cert.center.email}</p>
          </div>
        </div>

        {/* Título de la Constancia */}
        <div className="my-6 grid grid-cols-1 gap-4 border-b pb-6 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Documento
            </span>
            <p className="text-headline-sm font-bold text-primary">
              Constancia de Atención
            </p>
            <p className="text-body-sm text-muted-foreground">
              Turno Nº {cert.appointmentId}
            </p>
          </div>
          <div className="sm:text-right">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fecha de Emisión
            </span>
            <p className="text-body-md font-semibold text-foreground">
              {formatDate(todaySlot.date)}
            </p>
          </div>
        </div>

        {/* Datos del Paciente y Cobertura */}
        <div className="mb-6 rounded-md bg-muted/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Datos del Paciente
          </h2>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Nombre y Apellido</p>
              <p className="text-body-md font-medium text-foreground">
                {cert.patient.lastName}, {cert.patient.firstName}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Documento</p>
              <p className="text-body-md font-medium text-foreground">
                {cert.patient.documentType} {cert.patient.documentNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cobertura</p>
              <p className="text-body-sm text-foreground">{coverageLabel}</p>
            </div>
            {cert.authorization && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Nº de Autorización / Orden
                </p>
                <p className="text-body-sm font-semibold text-foreground">
                  {cert.authorization.number}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Datos de la Atención y Profesional */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Datos de la Consulta
          </h2>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Profesional</p>
              <p className="text-body-md font-medium text-foreground">
                {cert.professional.lastName}, {cert.professional.firstName}
              </p>
              <p className="text-xs text-muted-foreground">
                Matrícula: {cert.professional.licenseNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prestación</p>
              <p className="text-body-md font-medium text-foreground">
                {cert.service.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Duración: {cert.service.durationMinutes} min
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Día del Turno</p>
              <p className="text-body-md font-medium text-foreground">
                {formatDate(apptStart.date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horario</p>
              <p className="text-body-md font-medium tabular-nums text-foreground">
                {formatMinute(apptStart.minute)}–{formatMinute(apptEnd.minute)}{" "}
                hs
              </p>
            </div>
          </div>
        </div>

        {/* Declaración formal de asistencia */}
        <div className="my-6 rounded-md border border-border/80 bg-background p-4 text-body-sm text-foreground">
          <p>
            Por la presente, el{" "}
            <span className="font-semibold">{cert.center.name}</span> certifica
            que el/la paciente{" "}
            <span className="font-semibold">
              {cert.patient.lastName}, {cert.patient.firstName}
            </span>{" "}
            ({cert.patient.documentType} {cert.patient.documentNumber})
            concurrió a este centro asistencial el día{" "}
            <span className="font-semibold">{formatDate(apptStart.date)}</span>{" "}
            en el horario de {formatMinute(apptStart.minute)} a{" "}
            {formatMinute(apptEnd.minute)} hs para su atención en el servicio de{" "}
            <span className="font-semibold">{cert.service.name}</span> con el/la
            profesional{" "}
            <span className="font-semibold">
              {cert.professional.lastName}, {cert.professional.firstName}
            </span>
            .
          </p>
        </div>

        {/* Área de Firma y Sello */}
        <div className="mt-12 mb-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="flex flex-col items-center justify-end text-center">
            <div className="h-12 w-48 border-b border-muted-foreground/60" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Firma y sello del profesional
            </p>
          </div>
          <div className="flex flex-col items-center justify-end text-center">
            <div className="h-12 w-48 border-b border-muted-foreground/60" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Sello del centro / Recepción
            </p>
          </div>
        </div>

        {/* Pie institucional */}
        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          <p className="font-semibold uppercase tracking-wider text-muted-foreground">
            Constancia válida como comprobante de asistencia médica.
          </p>
          <p className="mt-1">
            Comprobante no válido como factura ni comprobante de pago. Emitido
            por {cert.center.name}.
          </p>
        </div>
      </div>
    </div>
  );
}
