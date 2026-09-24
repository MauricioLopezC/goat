"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { completeAppointment, expireAppointment } from "./actions";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionErrorAlert } from "@/components/action-error-alert";
import type { ActionResult } from "@/lib/actions";

// Confirmación para completar o marcar Vencido un turno Programado (HU-11).

const COPY = {
  COMPLETED: {
    trigger: "Marcar completado",
    title: "¿Marcar el turno como completado?",
    confirm: "Confirmar atención",
    action: completeAppointment,
  },
  EXPIRED: {
    trigger: "Marcar vencido",
    title: "¿Marcar el turno como vencido?",
    confirm: "Confirmar vencimiento",
    action: expireAppointment,
  },
} as const;

export function StatusChangeDialog({
  appointmentId,
  target,
  summary,
  returnSearch,
}: {
  appointmentId: number;
  target: keyof typeof COPY;
  /** Paciente, profesional, servicio, día y hora. */
  summary: string;
  /** Parámetros del calendario de origen, para conservarlos al volver. */
  returnSearch: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const copy = COPY[target];
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number }> | null,
    FormData
  >(async (_prevState, formData) => {
    const result = await copy.action({
      appointmentId,
      reason: String(formData.get("reason") ?? ""),
    });
    if (result.ok) {
      setOpen(false);
      const search = new URLSearchParams(returnSearch);
      search.set("changed", target);
      router.push(`/appointments/${appointmentId}?${search}`);
    }
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{copy.trigger}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{summary}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reason-${target}`}>Motivo (opcional)</Label>
            <Textarea
              id={`reason-${target}`}
              name="reason"
              maxLength={500}
              rows={3}
              disabled={pending}
            />
          </div>
          <ActionErrorAlert
            error={state && !state.ok ? state.error : undefined}
          />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Volver
            </AlertDialogCancel>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : copy.confirm}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
