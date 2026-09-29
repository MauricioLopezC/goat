"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { registerAuthorization } from "./actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionErrorAlert } from "@/components/action-error-alert";
import type { ActionResult } from "@/lib/actions";

// Autorización de la obra social de un turno (HU-21). Si ya había una, la
// corrige: el número anterior queda en el historial del turno.

export function AuthorizationDialog({
  appointmentId,
  returnSearch,
  summary,
  currentNumber,
}: {
  appointmentId: number;
  /** Parámetros del calendario de origen, para conservarlos al volver (HU-11). */
  returnSearch: string;
  summary: string;
  currentNumber: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number; authorizationNumber: string }> | null,
    FormData
  >(async (_prevState, formData) => {
    const result = await registerAuthorization({
      appointmentId,
      authorizationNumber: String(formData.get("authorizationNumber") ?? ""),
    });
    if (result.ok) {
      setOpen(false);
      const search = new URLSearchParams(returnSearch);
      search.set("billing", "authorized");
      router.replace(`/appointments/${appointmentId}?${search}`);
    }
    return result;
  }, null);
  const fieldError =
    state?.ok === false ? state.error.fieldErrors?.authorizationNumber : null;
  const correcting = currentNumber !== null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={correcting ? "outline" : "default"}>
          {correcting ? "Corregir autorización" : "Registrar autorización"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {correcting ? "Corregir autorización" : "Registrar autorización"}
          </DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="authorizationNumber">
              Número de autorización *
            </Label>
            <Input
              id="authorizationNumber"
              name="authorizationNumber"
              required
              maxLength={50}
              defaultValue={currentNumber ?? ""}
              autoComplete="off"
              aria-invalid={fieldError ? true : undefined}
              disabled={pending}
            />
            {correcting && (
              <p className="text-muted-foreground text-sm">
                El número anterior queda en el historial del turno.
              </p>
            )}
          </div>
          {state?.ok === false && <ActionErrorAlert error={state.error} />}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Volver
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
