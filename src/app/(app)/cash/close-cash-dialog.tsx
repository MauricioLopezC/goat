"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { closeCash } from "./actions";
import { notifyPaymentChange } from "@/lib/payments-client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ActionErrorAlert } from "@/components/action-error-alert";
import { formatAmount } from "@/lib/payments";
import { formatDate } from "@/lib/schedule";
import { AlertCircle, Lock } from "lucide-react";
import type { ActionResult } from "@/lib/actions";

// Diálogo de arqueo y cierre de caja (HU-27).
// Pide el efectivo contado, calcula la diferencia en vivo y exige observaciones
// si la diferencia no es cero.

export function CloseCashDialog({
  date,
  expectedCashAmount,
  totalAmount,
  paymentCount,
  actorRole,
  isToday,
}: {
  date: string;
  expectedCashAmount: string;
  totalAmount: string;
  paymentCount: number;
  actorRole?: string;
  isToday?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [countedStr, setCountedStr] = useState("");
  const [notes, setNotes] = useState("");

  const expectedNum = Number(expectedCashAmount) || 0;
  const countedNum = countedStr === "" ? null : Number(countedStr);
  const difference =
    countedNum !== null ? Number((countedNum - expectedNum).toFixed(2)) : null;

  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number; date: string }> | null,
    FormData
  >(async (_prevState, formData) => {
    const countedVal = Number(formData.get("countedCashAmount"));
    const notesVal = String(formData.get("notes") ?? "");

    const result = await closeCash({
      date,
      countedCashAmount: countedVal,
      notes: notesVal || undefined,
    });

    if (result.ok) {
      notifyPaymentChange();
      setOpen(false);
      if (!isToday && actorRole !== "MANAGER") {
        router.push(`/cash?closed=${date}`);
      } else {
        router.refresh();
      }
    }
    return result;
  }, null);

  const hasDifference = difference !== null && difference !== 0;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="gap-2">
          <Lock className="h-4 w-4" />
          Cerrar caja
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Cerrar la caja del día</AlertDialogTitle>
          <AlertDialogDescription>
            {formatDate(date)} · {paymentCount}{" "}
            {paymentCount === 1 ? "cobro registrado" : "cobros registrados"} por
            un total de {formatAmount(totalAmount)}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                Efectivo esperado por sistema:
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatAmount(expectedCashAmount)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="countedCashAmount">Efectivo contado *</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">
                $
              </span>
              <Input
                id="countedCashAmount"
                name="countedCashAmount"
                type="number"
                step="0.01"
                min="0"
                required
                className="pl-7 tabular-nums"
                placeholder="0.00"
                value={countedStr}
                onChange={(e) => setCountedStr(e.target.value)}
                disabled={pending}
                autoFocus
              />
            </div>
          </div>

          {difference !== null && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <span className="text-sm font-medium">Diferencia:</span>
              <div className="flex items-center gap-2">
                <span className="font-bold tabular-nums">
                  {difference > 0
                    ? `+${formatAmount(difference.toFixed(2))}`
                    : formatAmount(difference.toFixed(2))}
                </span>
                {difference === 0 ? (
                  <Badge
                    variant="outline"
                    className="bg-success-soft text-success-soft-foreground border-success-soft-border"
                  >
                    Exacto
                  </Badge>
                ) : difference < 0 ? (
                  <Badge
                    variant="outline"
                    className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border"
                  >
                    Faltante
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-info-soft text-info-soft-foreground border-info-soft-border"
                  >
                    Sobrante
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-notes">
              Observaciones{" "}
              {hasDifference
                ? "(Obligatorio por diferencia de caja) *"
                : "(Opcional)"}
            </Label>
            <Textarea
              id="cash-notes"
              name="notes"
              required={hasDifference}
              maxLength={500}
              placeholder={
                hasDifference
                  ? "Explicá el motivo de la diferencia entre el efectivo esperado y el contado…"
                  : "Comentarios administrativos sobre el cierre del día (opcional)…"
              }
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
          </div>

          <Alert className="bg-scheduled-soft text-scheduled-soft-foreground border-scheduled-soft-border">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Aviso importante</AlertTitle>
            <AlertDescription className="text-scheduled-soft-foreground text-xs">
              Una vez cerrada la caja, se genera la foto definitiva del cierre:
              no se podrán registrar nuevos cobros para este día (ni recobros
              tras anulación) y posteriormente solo el gerente podrá anular
              cobros como ajuste posterior.
            </AlertDescription>
          </Alert>

          {state?.ok === false && <ActionErrorAlert error={state.error} />}

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Volver
            </AlertDialogCancel>
            <Button type="submit" disabled={pending || countedStr === ""}>
              {pending ? "Cerrando caja…" : "Confirmar cierre"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
