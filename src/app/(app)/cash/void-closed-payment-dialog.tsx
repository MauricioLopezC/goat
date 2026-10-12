"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { voidCashPayment } from "./actions";
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

// Diálogo para que el gerente anule un cobro de una caja cerrada (HU-27).
// Registra la anulación como ajuste posterior sin reabrir la caja.

export function VoidClosedPaymentDialog({
  paymentId,
  description,
}: {
  paymentId: number;
  description: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number; appointmentId: number }> | null,
    FormData
  >(async (_prevState, formData) => {
    const result = await voidCashPayment({
      paymentId,
      reason: String(formData.get("reason") ?? ""),
    });
    if (result.ok) {
      setOpen(false);
      router.refresh();
    }
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive-soft hover:text-destructive text-xs h-7 px-2"
        >
          Anular cobro
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular cobro de caja cerrada?</AlertDialogTitle>
          <AlertDialogDescription>
            {description}. Esta caja ya se encuentra cerrada. La caja no se
            reabrirá: esta operación se registrará como un ajuste posterior de
            gerencia y se actualizará el total corregido. El turno volverá a
            quedar pendiente de cobro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`void-reason-${paymentId}`}>
              Motivo de la corrección *
            </Label>
            <Textarea
              id={`void-reason-${paymentId}`}
              name="reason"
              required
              maxLength={500}
              placeholder="Ej.: cobro cargado por error en fecha equivocada o duplicado"
              rows={3}
              disabled={pending}
            />
          </div>
          {state?.ok === false && <ActionErrorAlert error={state.error} />}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Volver
            </AlertDialogCancel>
            <Button variant="destructive" type="submit" disabled={pending}>
              {pending ? "Anulando…" : "Confirmar anulación posterior"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
