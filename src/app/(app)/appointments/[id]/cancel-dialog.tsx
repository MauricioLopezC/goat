"use client";

import { useActionState } from "react";
import { cancelAppointment } from "./actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Diálogo de confirmación para cancelar un turno (HU-10).
// Solo se muestra cuando el turno está SCHEDULED y el actor es RECEPTIONIST o MANAGER.

export function CancelAppointmentDialog({
  appointmentId,
  summary,
}: {
  appointmentId: number;
  /** Texto que se muestra en la descripción del diálogo: paciente, profesional, servicio, día y hora. */
  summary: string;
}) {
  const [state, formAction, pending] = useActionState(cancelAppointment, null);

  if (state?.ok) {
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
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Cancelar turno</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar este turno?</AlertDialogTitle>
          <AlertDialogDescription>{summary}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Motivo de cancelación *</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              maxLength={500}
              placeholder="Ej.: el paciente llamó para cancelar por viaje"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="requestedBy">Quién solicitó la cancelación *</Label>
            <Input
              id="requestedBy"
              name="requestedBy"
              required
              maxLength={100}
              placeholder="Ej.: el paciente, el profesional, el centro"
            />
          </div>
          {state?.ok === false && (
            <Alert
              role="alert"
              className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border"
            >
              <AlertDescription className="text-destructive-soft-foreground">
                {state.error.message}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Volver</AlertDialogCancel>
            <Button variant="destructive" type="submit" disabled={pending}>
              {pending ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
