"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { voidPayment } from "./actions";
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

// Anulación de un cobro mal cargado (HU-21). No lo borra: queda con quién lo
// anuló, cuándo y por qué, y el turno se puede volver a cobrar.

export function VoidPaymentDialog({
  paymentId,
  appointmentId,
  returnSearch,
  description,
}: {
  paymentId: number;
  appointmentId: number;
  /** Parámetros del calendario de origen, para conservarlos al volver (HU-11). */
  returnSearch: string;
  /** Monto y medio del cobro que se anula. */
  description: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number; appointmentId: number }> | null,
    FormData
  >(async (_prevState, formData) => {
    const result = await voidPayment({
      paymentId,
      reason: String(formData.get("reason") ?? ""),
    });
    if (result.ok) {
      setOpen(false);
      const search = new URLSearchParams(returnSearch);
      search.set("billing", "voided");
      router.replace(`/appointments/${appointmentId}?${search}`);
    }
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Anular cobro</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular este cobro?</AlertDialogTitle>
          <AlertDialogDescription>
            {description}. El cobro no se borra: queda registrado como anulado y
            el turno se puede volver a cobrar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="void-reason">Motivo de la anulación *</Label>
            <Textarea
              id="void-reason"
              name="reason"
              required
              maxLength={500}
              placeholder="Ej.: se eligió débito pero pagó en efectivo"
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
              {pending ? "Anulando…" : "Confirmar anulación"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
