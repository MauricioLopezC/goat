import { AppointmentStatus, CoverageType } from "@/generated/prisma/enums";
import { toLocalSlot } from "@/lib/schedule";

// Estado de cobro o autorización de un turno (HU-21). No se persiste: se
// calcula del paciente, del servicio, del cobro vigente y de la autorización.

export type PaymentState =
  "PENDING_PAYMENT" | "PAID" | "PENDING_AUTHORIZATION" | "AUTHORIZED";

export type PaymentStateInput = {
  coverageType: CoverageType;
  requiresReferral: boolean;
  hasActivePayment: boolean;
  authorizationNumber: string | null;
};

/// `null` cuando no aplica: paciente con obra social y servicio sin orden.
export function paymentState(input: PaymentStateInput): PaymentState | null {
  if (input.coverageType === CoverageType.PRIVATE)
    return input.hasActivePayment ? "PAID" : "PENDING_PAYMENT";
  if (!input.requiresReferral) return null;
  return input.authorizationNumber ? "AUTHORIZED" : "PENDING_AUTHORIZATION";
}

/// Un turno admite cobro o autorización si está Programado y empieza hoy (hora
/// del centro) o si ya está Completado.
export function isChargeable(
  appointment: { status: AppointmentStatus; startsAt: Date },
  now = new Date(),
): boolean {
  if (appointment.status === AppointmentStatus.COMPLETED) return true;
  return (
    appointment.status === AppointmentStatus.SCHEDULED &&
    toLocalSlot(appointment.startsAt).date === toLocalSlot(now).date
  );
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  PENDING_PAYMENT: "Pendiente de cobro",
  PAID: "Cobrado",
  PENDING_AUTHORIZATION: "Pendiente de autorización",
  AUTHORIZED: "Autorizado",
};

/// Badge del estado de cobro. Pendiente en `info`, resuelto en `primary`, para
/// no confundirlo con los colores del estado del turno (docs/DESIGN.md).
export const PAYMENT_STATE_BADGE_CLASS: Record<PaymentState, string> = {
  PENDING_PAYMENT:
    "bg-info-soft text-info-soft-foreground border-info-soft-border",
  PAID: "bg-primary-soft text-primary-soft-foreground border-primary-soft-border",
  PENDING_AUTHORIZATION:
    "bg-info-soft text-info-soft-foreground border-info-soft-border",
  AUTHORIZED:
    "bg-primary-soft text-primary-soft-foreground border-primary-soft-border",
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

/// Monto en pesos a partir del texto decimal que devuelve la DAL ("15000.00").
export function formatAmount(amount: string): string {
  return currency.format(Number(amount));
}
