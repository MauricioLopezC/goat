import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ActionError } from "@/lib/actions";
import { formatInstant, type AffectedAppointment } from "@/lib/schedule";

// Error de una acción de agenda (HU-05) o de un cierre del centro (HU-14). Con
// `FUTURE_APPOINTMENTS` lista los turnos afectados, con el teléfono del
// paciente para avisarle y el acceso a cada turno para cancelarlo o
// reprogramarlo antes.

function affectedAppointments(error: ActionError): AffectedAppointment[] {
  const appointments = error.meta?.appointments;
  return error.code === "FUTURE_APPOINTMENTS" && Array.isArray(appointments)
    ? (appointments as AffectedAppointment[])
    : [];
}

function scheduleMessage(count: number) {
  return count === 1
    ? "Hay un turno programado que quedaría fuera de horario. Cancelalo antes de continuar."
    : `Hay ${count} turnos programados que quedarían fuera de horario. Cancelalos antes de continuar.`;
}

export function ActionErrorAlert({
  error,
  affectedMessage = scheduleMessage,
}: {
  error?: ActionError;
  /// Texto sobre la lista de turnos afectados, según la cantidad.
  affectedMessage?: (count: number) => string;
}) {
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
            <p>{affectedMessage(appointments.length)}</p>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {appointments.map((appointment) => (
                <li key={appointment.id}>
                  <Link
                    href={`/appointments/${appointment.id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    <span className="tabular-nums">
                      {formatInstant(new Date(appointment.startsAt))}
                    </span>{" "}
                    · {appointment.patientName}
                  </Link>{" "}
                  · Tel.{" "}
                  <span className="tabular-nums">
                    {appointment.patientPhone}
                  </span>{" "}
                  · {appointment.serviceName} · {appointment.professionalName}
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
