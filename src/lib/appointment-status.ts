import { AppointmentStatus } from "@/generated/prisma/enums";

// Estado del turno en la interfaz: nombre y colores de docs/DESIGN.md
// ("Estado del turno → color").

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Programado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
};

/// Badge de estado: fondo suave, borde y texto del mismo tono.
export const APPOINTMENT_STATUS_BADGE_CLASS: Record<AppointmentStatus, string> =
  {
    SCHEDULED: "bg-info-soft text-info-soft-foreground border-info-soft-border",
    COMPLETED:
      "bg-success-soft text-success-soft-foreground border-success-soft-border",
    CANCELLED: "bg-muted text-muted-foreground border-input",
    EXPIRED:
      "bg-warning-soft text-warning-soft-foreground border-warning-soft-border",
  };

/// Borde izquierdo de 4 px del bloque de turno en el calendario.
export const APPOINTMENT_STATUS_BORDER_CLASS: Record<
  AppointmentStatus,
  string
> = {
  SCHEDULED: "border-l-info",
  COMPLETED: "border-l-success",
  CANCELLED: "border-l-placeholder",
  EXPIRED: "border-l-warning",
};

/// Los estados que ocupan el horario. Cancelados y vencidos lo liberan.
export function occupiesSlot(status: AppointmentStatus): boolean {
  return (
    status === AppointmentStatus.SCHEDULED ||
    status === AppointmentStatus.COMPLETED
  );
}
