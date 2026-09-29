"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { registerPayment } from "./actions";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ActionErrorAlert } from "@/components/action-error-alert";
import type { ActionResult } from "@/lib/actions";
import { formatAmount } from "@/lib/payments";

// Cobro de un turno particular en el mostrador (HU-21). Antes de confirmar
// muestra el monto y el medio elegido.

export function PaymentDialog({
  appointmentId,
  returnSearch,
  summary,
  price,
  paymentMethods,
}: {
  appointmentId: number;
  /** Parámetros del calendario de origen, para conservarlos al volver (HU-11). */
  returnSearch: string;
  summary: string;
  /** Valor del servicio como texto decimal ("15000.00"). */
  price: string;
  paymentMethods: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [methodId, setMethodId] = useState("");
  const method = paymentMethods.find((m) => String(m.id) === methodId);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number; amount: string }> | null,
    FormData
  >(async () => {
    const result = await registerPayment({
      appointmentId,
      paymentMethodId: Number(methodId),
    });
    if (result.ok) {
      setOpen(false);
      const search = new URLSearchParams(returnSearch);
      search.set("billing", "paid");
      router.replace(`/appointments/${appointmentId}?${search}`);
    }
    return result;
  }, null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMethodId("");
      }}
    >
      <DialogTrigger asChild>
        <Button>Cobrar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar turno</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <p className="text-headline-sm tabular-nums">{formatAmount(price)}</p>
          <FieldSet>
            <FieldLegend variant="label">Medio de pago *</FieldLegend>
            <RadioGroup
              aria-label="Medio de pago"
              value={methodId}
              onValueChange={setMethodId}
              className="grid gap-2 sm:grid-cols-2"
            >
              {paymentMethods.map((m) => (
                <Field
                  key={m.id}
                  orientation="horizontal"
                  className="rounded-lg border p-3"
                >
                  <RadioGroupItem
                    id={`payment-method-${m.id}`}
                    value={String(m.id)}
                    disabled={pending}
                  />
                  <FieldLabel htmlFor={`payment-method-${m.id}`}>
                    {m.name}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
          </FieldSet>
          {method && (
            <p className="text-muted-foreground">
              Vas a cobrar{" "}
              <span className="text-foreground font-medium tabular-nums">
                {formatAmount(price)}
              </span>{" "}
              con{" "}
              <span className="text-foreground font-medium">{method.name}</span>
              .
            </p>
          )}
          {state?.ok === false && <ActionErrorAlert error={state.error} />}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Volver
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !method}>
              {pending ? "Cobrando…" : "Confirmar cobro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
