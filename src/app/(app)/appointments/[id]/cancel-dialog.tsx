"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { ActionResult } from "@/lib/actions";

// Diálogo de confirmación para cancelar un turno (HU-10).
// Solo se muestra cuando el turno está SCHEDULED y el actor es RECEPTIONIST o MANAGER.

export function CancelAppointmentDialog({
  appointmentId,
  summary,
  returnSearch,
}: {
  appointmentId: number;
  /** Texto que se muestra en la descripción del diálogo: paciente, profesional, servicio, día y hora. */
  summary: string;
  /** Parámetros del calendario de origen, para conservarlos al volver (HU-11). */
  returnSearch: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number }> | null,
    FormData
  >(async (_prevState, formData) => {
    const reason = String(formData.get("reason") ?? "");
    const requestedBy = String(formData.get("requestedBy") ?? "");
    const result = await cancelAppointment({
      appointmentId,
      reason,
      requestedBy,
    });
    if (result.ok) {
      setOpen(false);
      const search = new URLSearchParams(returnSearch);
      search.set("cancelled", "1");
      router.push(`/appointments/${appointmentId}?${search}`);
    }
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Cancelar turno</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar este turno?</AlertDialogTitle>
          <AlertDialogDescription>{summary}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Motivo de cancelación *</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              maxLength={500}
              placeholder="Ej.: el paciente llamó para cancelar por viaje"
              rows={3}
              disabled={pending}
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
              disabled={pending}
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
            <AlertDialogCancel type="button" disabled={pending}>
              Volver
            </AlertDialogCancel>
            <Button variant="destructive" type="submit" disabled={pending}>
              {pending ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
