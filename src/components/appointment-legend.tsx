import { AlertCircle, Stethoscope } from "lucide-react";
import {
  APPOINTMENT_STATUS_BORDER_CLASS,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointment-status";
import { AppointmentStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { PaymentStateIcon } from "@/components/payment-state-icon";
import { PAYMENT_STATE_LABEL, PAYMENT_STATES } from "@/lib/payments";

// Rayado diagonal del horario de atención que ya pasó (sincronizado con day-view.tsx).
const PAST_PATTERN_CLASS =
  "bg-muted bg-[repeating-linear-gradient(135deg,var(--color-placeholder)_0_1.5px,transparent_1.5px_7px)]";

const STATUS_ORDER: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.EXPIRED,
  AppointmentStatus.CANCELLED,
];

export interface AppointmentLegendProps {
  /**
   * Si incluye bloques libres (true en calendario y vista mes, false en agenda del profesional).
   * @default true
   */
  showFreeBlocks?: boolean;
  /**
   * Si incluye la referencia de fuera de horario (vistas horarias con franjas).
   * @default true si showFreeBlocks es true
   */
  showOffHours?: boolean;
  /**
   * Si los bloques libres aceptan clic para dar turno (vista día del calendario).
   * @default false
   */
  freeClickable?: boolean;
  /**
   * Si muestra la referencia de horario pasado (por defecto true si freeClickable es true).
   */
  showPastHours?: boolean;
  /**
   * Si muestra la referencia de cobro y autorización (vistas de mesa de entradas y gerencia).
   * @default false
   */
  showPayments?: boolean;
  className?: string;
}

/**
 * Leyenda unificada para vistas de Calendario y Agenda (docs/DESIGN.md).
 * Regla canónica: El color es el estado del turno; todo lo demás es ícono.
 */
export function AppointmentLegend({
  showFreeBlocks = true,
  showOffHours,
  freeClickable = false,
  showPastHours,
  showPayments = false,
  className,
}: AppointmentLegendProps) {
  const includePast = showPastHours ?? freeClickable;
  const includeOffHours = showOffHours ?? showFreeBlocks;

  return (
    <ul
      aria-label="Referencias"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm",
        className,
      )}
    >
      {showFreeBlocks && (
        <li className="flex items-center gap-1.5">
          <span className="border-primary/60 bg-primary-soft size-3.5 shrink-0 rounded-sm border-2 border-dashed" />
          {freeClickable
            ? "Bloque libre (clic para dar turno)"
            : "Bloque libre"}
        </li>
      )}

      <li className="flex items-center gap-1.5">
        <span className="border-holiday/40 bg-holiday/25 size-3.5 shrink-0 rounded-sm border-2 border-dashed" />
        Centro cerrado (feriado o día excepcional)
      </li>

      {STATUS_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span
            className={cn(
              "bg-card size-3 shrink-0 rounded-sm border border-l-4",
              APPOINTMENT_STATUS_BORDER_CLASS[status],
            )}
          />
          {APPOINTMENT_STATUS_LABEL[status]}
        </li>
      ))}

      <li className="flex items-center gap-1.5">
        <AlertCircle className="text-destructive size-3.5 shrink-0" />
        Urgente
      </li>

      <li className="flex items-center gap-1.5">
        <Stethoscope className="text-primary size-3.5 shrink-0" />
        Atención registrada
      </li>

      {showPayments &&
        PAYMENT_STATES.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <PaymentStateIcon state={state} />
            {PAYMENT_STATE_LABEL[state]}
          </li>
        ))}

      {includeOffHours && (
        <li className="flex items-center gap-1.5">
          <span className="bg-muted border-border size-3 shrink-0 rounded-sm border" />
          Fuera de horario
        </li>
      )}

      {includePast && (
        <li className="flex items-center gap-1.5">
          <span
            className={cn(
              "border-border size-3 shrink-0 rounded-sm border",
              PAST_PATTERN_CLASS,
            )}
          />
          Horario pasado
        </li>
      )}
    </ul>
  );
}
