"use client";

import { useActionState, useEffect, useState } from "react";
import { cancelProfessionalAppointment } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FutureAppointmentCancel({
  appointmentId,
  professionalId,
  description,
  onCancelled,
}: {
  appointmentId: number;
  professionalId: number;
  description: string;
  onCancelled?: (appointmentId: number) => void;
}) {
  const [state, action, pending] = useActionState(
    cancelProfessionalAppointment,
    null,
  );
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      onCancelled?.(appointmentId);
    }
  }, [state, appointmentId, onCancelled]);

  if (state?.ok)
    return (
      <Alert
        role="status"
        className="bg-success-soft text-success-soft-foreground border-success-soft-border"
      >
        <AlertDescription>
          Turno #{appointmentId} cancelado. El horario quedó liberado.
        </AlertDescription>
      </Alert>
    );

  return (
    <form
      action={action}
      className="flex flex-col gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0"
    >
      <p className="text-sm font-medium">{description}</p>
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
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
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

export type FutureAppointmentItem = {
  id: number;
  startsAt: Date | string;
  service: { name: string };
  patient: { firstName: string; lastName: string };
};

export function FutureAppointmentsSection({
  appointments,
  professionalId,
  professionalName,
  canCancel,
}: {
  appointments: FutureAppointmentItem[];
  professionalId: number;
  professionalName: string;
  canCancel: boolean;
}) {
  const [cancelledIds, setCancelledIds] = useState<number[]>([]);

  function handleCancelled(id: number) {
    setCancelledIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return (
    <Card id="future-appointments">
      <CardHeader>
        <CardTitle>
          Turnos futuros programados ({appointments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cancelledIds.map((id) => (
          <Alert
            key={`cancelled-${id}`}
            role="status"
            className="bg-success-soft text-success-soft-foreground border-success-soft-border"
          >
            <AlertDescription>
              Turno #{id} cancelado. El horario quedó liberado.
            </AlertDescription>
          </Alert>
        ))}
        {appointments.length ? (
          appointments.map((appointment) => {
            const startsAt =
              appointment.startsAt instanceof Date
                ? appointment.startsAt
                : new Date(appointment.startsAt);
            const description = `#${appointment.id} · ${startsAt.toLocaleString("es-AR")} · ${appointment.service.name} · ${appointment.patient.lastName}, ${appointment.patient.firstName} · ${professionalName}`;
            return canCancel ? (
              <FutureAppointmentCancel
                key={appointment.id}
                appointmentId={appointment.id}
                professionalId={professionalId}
                description={description}
                onCancelled={handleCancelled}
              />
            ) : (
              <p
                key={appointment.id}
                className="text-sm border-b border-border pb-2 last:border-b-0"
              >
                {description}
              </p>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay turnos futuros programados.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
