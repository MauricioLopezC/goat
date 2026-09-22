"use client";

import { useActionState, useState } from "react";
import { cancelProfessionalAppointment } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FutureAppointmentCancel({
  appointmentId,
  professionalId,
  description,
}: {
  appointmentId: number;
  professionalId: number;
  description: string;
}) {
  const [state, action, pending] = useActionState(
    cancelProfessionalAppointment,
    null,
  );
  const [confirmed, setConfirmed] = useState(false);
  if (state?.ok)
    return (
      <Alert role="status">
        <AlertDescription>
          Turno #{appointmentId} cancelado. El horario quedó liberado.
        </AlertDescription>
      </Alert>
    );
  return (
    <form
      action={action}
      className="flex flex-col gap-3 border-b border-border pb-4"
    >
      <p>{description}</p>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="professionalId" value={professionalId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`reason-${appointmentId}`}>
            Motivo de cancelación *
          </Label>
          <Input
            id={`reason-${appointmentId}`}
            name="reason"
            required
            maxLength={500}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`requested-${appointmentId}`}>
            Quién la solicitó *
          </Label>
          <Input
            id={`requested-${appointmentId}`}
            name="requestedBy"
            required
            maxLength={100}
          />
        </div>
      </div>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        Confirmo la cancelación de {description}. No se puede deshacer.
      </label>
      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertDescription>{state.error.message}</AlertDescription>
        </Alert>
      )}
      <div>
        <Button
          variant="destructive"
          type="submit"
          disabled={!confirmed || pending}
        >
          {pending ? "Cancelando…" : "Cancelar turno"}
        </Button>
      </div>
    </form>
  );
}
