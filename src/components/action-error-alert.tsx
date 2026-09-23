import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ActionError } from "@/lib/actions";
import { formatInstant, type AffectedAppointment } from "@/lib/schedule";

// Error de una acción de agenda (HU-05). Con `FUTURE_APPOINTMENTS` lista los
// turnos que el cambio dejaría fuera de horario, para cancelarlos antes.

function affectedAppointments(error: ActionError): AffectedAppointment[] {
  const appointments = error.meta?.appointments;
  return error.code === "FUTURE_APPOINTMENTS" && Array.isArray(appointments)
    ? (appointments as AffectedAppointment[])
    : [];
}

export function ActionErrorAlert({ error }: { error?: ActionError }) {
  if (!error) return null;
  const appointments = affectedAppointments(error);

  return (
    <Alert
      role="alert"
      className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border"
    >
      <AlertCircle />
      <AlertDescription className="text-destructive-soft-foreground flex flex-col gap-2">
        {appointments.length ? (
          <>
            <p>
              {appointments.length === 1
                ? "Hay un turno programado que quedaría fuera de horario. Cancelalo antes de continuar."
                : `Hay ${appointments.length} turnos programados que quedarían fuera de horario. Cancelalos antes de continuar.`}
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {appointments.map((appointment) => (
                <li key={appointment.id}>
                  <span className="tabular-nums">
                    {formatInstant(new Date(appointment.startsAt))}
                  </span>{" "}
                  · {appointment.patientName} · {appointment.serviceName} ·{" "}
                  {appointment.professionalName}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{error.message}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
