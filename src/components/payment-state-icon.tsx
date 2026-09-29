import { CircleDollarSign, FileCheck } from "lucide-react";
import { PAYMENT_STATE_LABEL, type PaymentState } from "@/lib/payments";
import { cn } from "@/lib/utils";

// Marca de cobro o autorización de un turno en el calendario (HU-21): el
// ícono dice qué es (cobro o autorización) y el color, si está pendiente.

export function PaymentStateIcon({
  state,
  className,
}: {
  state: PaymentState;
  className?: string;
}) {
  const Icon =
    state === "PENDING_PAYMENT" || state === "PAID"
      ? CircleDollarSign
      : FileCheck;
  const pending =
    state === "PENDING_PAYMENT" || state === "PENDING_AUTHORIZATION";
  return (
    <Icon
      role="img"
      aria-label={PAYMENT_STATE_LABEL[state]}
      className={cn(
        "size-3.5 shrink-0",
        pending ? "text-info-soft-foreground" : "text-primary",
        className,
      )}
    >
      <title>{PAYMENT_STATE_LABEL[state]}</title>
    </Icon>
  );
}
