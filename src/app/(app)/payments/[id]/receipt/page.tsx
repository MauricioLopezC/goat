import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo-goat.png";
import { requirePageRole } from "@/lib/dal/auth";
import { getPaymentReceipt } from "@/lib/dal/payments";
import { Role } from "@/generated/prisma/enums";
import { DomainError } from "@/lib/actions";
import { formatAmount } from "@/lib/payments";
import { formatReceiptNumber } from "@/lib/center-profile";
import {
  formatDate,
  formatInstant,
  formatMinute,
  toLocalSlot,
} from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Comprobante de cobro · Goat",
};

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    notFound();
  }

  const actor = await requirePageRole(Role.RECEPTIONIST, Role.MANAGER);

  let receipt;
  try {
    receipt = await getPaymentReceipt(paymentId, actor);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const apptStart = toLocalSlot(receipt.appointment.startsAt);
  const apptEnd = toLocalSlot(receipt.appointment.endsAt);
  const coverageLabel =
    receipt.patient.coverageType === "PRIVATE"
      ? "Particular"
      : `${receipt.patient.healthInsurer ?? "Obra social"}${
          receipt.patient.healthPlan ? ` · ${receipt.patient.healthPlan}` : ""
        }${
          receipt.patient.affiliateNumber
            ? ` (Nº ${receipt.patient.affiliateNumber})`
            : ""
        }`;

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de navegación superior (no imprimible) */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/appointments/${receipt.appointment.id}`}>
              <ArrowLeft className="size-4" />
              Volver al turno #{receipt.appointment.id}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/today">Turnos de hoy</Link>
          </Button>
        </div>
        <PrintButton />
      </div>

      {/* Documento / Comprobante listo para hoja A4 */}
      <div className="mx-auto w-full max-w-2xl rounded-lg border bg-card p-6 shadow-xs text-foreground md:p-8 print:border-none print:p-0 print:shadow-none print:max-w-none">
        {/* Encabezado institucional del centro */}
        <div className="flex flex-col items-center border-b pb-6 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <Image
              src={logo}
              width={48}
              height={48}
              alt={receipt.center.name}
              className="size-12 shrink-0 rounded-xl"
              priority
            />
            <div>
              <h1 className="text-headline-md font-bold text-foreground">
                {receipt.center.name}
              </h1>
              <p className="text-body-sm text-muted-foreground">
                {receipt.center.legalName}
              </p>
            </div>
          </div>
          <div className="mt-3 text-right text-xs text-muted-foreground sm:mt-0">
            <p className="font-semibold text-foreground">
              CUIT {receipt.center.cuit}
            </p>
            <p>{receipt.center.address}</p>
            <p>Tel: {receipt.center.phone}</p>
            <p>{receipt.center.email}</p>
          </div>
        </div>

        {/* Marca de anulación si el cobro fue anulado */}
        {receipt.status === "VOIDED" && (
          <div className="my-6 rounded-lg border-2 border-destructive bg-destructive-soft p-4 text-destructive-soft-foreground">
            <div className="flex items-center justify-between">
              <span className="text-headline-sm font-bold uppercase tracking-wider text-destructive">
                Comprobante Anulado
              </span>
              {receipt.voidedAt && (
                <span className="text-body-sm font-medium">
                  Anulado el {formatInstant(receipt.voidedAt)}
                </span>
              )}
            </div>
            {receipt.voidReason && (
              <p className="mt-2 text-body-sm">
                <span className="font-semibold">Motivo:</span>{" "}
                {receipt.voidReason}
              </p>
            )}
            {receipt.voidedBy && (
              <p className="mt-1 text-xs text-muted-foreground">
                Anulado por: {receipt.voidedBy.lastName},{" "}
                {receipt.voidedBy.firstName}
              </p>
            )}
          </div>
        )}

        {/* Datos del Comprobante */}
        <div className="my-6 grid grid-cols-1 gap-4 border-b pb-6 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Documento
            </span>
            <p className="text-headline-sm font-bold text-primary">
              {formatReceiptNumber(receipt.receiptNumber)}
            </p>
            <p className="text-body-sm text-muted-foreground">
              Cobrado por: {receipt.createdBy.firstName}{" "}
              {receipt.createdBy.lastName}
            </p>
          </div>
          <div className="sm:text-right">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fecha y Hora de Emisión
            </span>
            <p className="text-body-md font-semibold text-foreground">
              {formatInstant(receipt.createdAt)}
            </p>
            <div className="mt-1 sm:justify-end">
              <Badge
                variant="outline"
                className={
                  receipt.status === "PAID"
                    ? "border-success-soft-border bg-success-soft text-success-soft-foreground"
                    : "border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground"
                }
              >
                {receipt.status === "PAID" ? "Cobrado" : "Anulado"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Secciones: Paciente y Turno */}
        <div className="grid grid-cols-1 gap-6 border-b pb-6 sm:grid-cols-2">
          {/* Paciente */}
          <div className="space-y-1">
            <h2 className="text-label-md uppercase tracking-wider text-muted-foreground">
              Datos del Paciente
            </h2>
            <p className="font-semibold text-foreground">
              {receipt.patient.lastName}, {receipt.patient.firstName}
            </p>
            <p className="text-body-sm text-muted-foreground">
              {receipt.patient.documentType} {receipt.patient.documentNumber}
            </p>
            {receipt.patient.email && (
              <p className="text-body-sm text-muted-foreground">
                {receipt.patient.email}
              </p>
            )}
            <p className="text-body-sm text-muted-foreground">
              Cobertura: {coverageLabel}
            </p>
          </div>

          {/* Turno */}
          <div className="space-y-1">
            <h2 className="text-label-md uppercase tracking-wider text-muted-foreground">
              Datos de la Atención
            </h2>
            <p className="font-semibold text-foreground">
              {receipt.appointment.service.name}
            </p>
            <p className="text-body-sm text-muted-foreground">
              {receipt.appointment.professional.lastName},{" "}
              {receipt.appointment.professional.firstName} (Mat.{" "}
              {receipt.appointment.professional.licenseNumber})
            </p>
            <p className="text-body-sm text-muted-foreground">
              {formatDate(apptStart.date)}, {formatMinute(apptStart.minute)}–
              {formatMinute(apptEnd.minute)}
            </p>
            <p className="text-body-sm text-muted-foreground">
              Turno #{receipt.appointment.id}
            </p>
          </div>
        </div>

        {/* Detalle del Cobro */}
        <div className="my-6">
          <h2 className="mb-3 text-label-md uppercase tracking-wider text-muted-foreground">
            Detalle del Cobro
          </h2>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Concepto</th>
                  <th className="px-4 py-2 font-medium">Medio de pago</th>
                  <th className="px-4 py-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {receipt.appointment.service.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {receipt.paymentMethod}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {formatAmount(receipt.amount)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20 font-bold">
                  <td colSpan={2} className="px-4 py-3 text-foreground">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-headline-sm tabular-nums text-foreground">
                    {formatAmount(receipt.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Pie con leyenda obligatoria */}
        <div className="mt-8 border-t pt-6 text-center">
          <p className="text-body-sm font-bold uppercase tracking-wider text-muted-foreground">
            {receipt.center.legend}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Constancia de cobro emitida por el sistema de gestión del centro.
          </p>
        </div>
      </div>
    </div>
  );
}
