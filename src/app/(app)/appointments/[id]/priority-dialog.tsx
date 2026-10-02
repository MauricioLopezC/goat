"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentPriority } from "./actions";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { ActionErrorAlert } from "@/components/action-error-alert";
import type { ActionResult } from "@/lib/actions";

export function PriorityChangeDialog({
  appointmentId,
  currentPriority,
  summary,
  returnSearch,
}: {
  appointmentId: number;
  currentPriority: "NORMAL" | "URGENT";
  summary: string;
  returnSearch: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const targetPriority = currentPriority === "NORMAL" ? "URGENT" : "NORMAL";
  const [selectedPriority, setSelectedPriority] = useState<"NORMAL" | "URGENT">(
    targetPriority,
  );
  const [reason, setReason] = useState("");

  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number }> | null,
    FormData
  >(async () => {
    const result = await updateAppointmentPriority({
      appointmentId,
      priority: selectedPriority,
      reason: reason.trim() || undefined,
    });
    if (result.ok) {
      setOpen(false);
      const search = new URLSearchParams(returnSearch);
      search.set("priorityChanged", selectedPriority);
      router.push(`/appointments/${appointmentId}?${search}`);
    }
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Cambiar prioridad</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cambiar prioridad del turno</AlertDialogTitle>
          <AlertDialogDescription>{summary}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Nueva prioridad</Label>
            <RadioGroup
              value={selectedPriority}
              onValueChange={(val) =>
                setSelectedPriority(val as "NORMAL" | "URGENT")
              }
              className="grid grid-cols-2 gap-3"
            >
              <Field orientation="horizontal" className="rounded-lg border p-3">
                <RadioGroupItem id="dialog-priority-normal" value="NORMAL" />
                <FieldLabel htmlFor="dialog-priority-normal">Normal</FieldLabel>
              </Field>
              <Field orientation="horizontal" className="rounded-lg border p-3">
                <RadioGroupItem id="dialog-priority-urgent" value="URGENT" />
                <FieldLabel
                  htmlFor="dialog-priority-urgent"
                  className="font-medium text-destructive"
                >
                  Urgente
                </FieldLabel>
              </Field>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority-reason">
              {selectedPriority === "URGENT"
                ? "Motivo de la urgencia (obligatorio)"
                : "Motivo del cambio (opcional)"}
            </Label>
            <Textarea
              id="priority-reason"
              name="reason"
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              placeholder={
                selectedPriority === "URGENT"
                  ? "Indicá el motivo por el cual este turno requiere atención urgente..."
                  : "Observación sobre el cambio de prioridad..."
              }
            />
          </div>

          <ActionErrorAlert
            error={state && !state.ok ? state.error : undefined}
          />

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Volver
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={
                pending ||
                selectedPriority === currentPriority ||
                (selectedPriority === "URGENT" && reason.trim().length === 0)
              }
            >
              {pending ? "Guardando…" : "Confirmar cambio"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
