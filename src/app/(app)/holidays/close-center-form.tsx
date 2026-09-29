"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { ActionErrorAlert } from "@/components/action-error-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/schedule";
import { getTodayDateString } from "@/lib/utils";
import { createHoliday, type HolidayMutationState } from "./actions";

type Pending = { date: string; description: string; formData: FormData };

function closureMessage(count: number) {
  return count === 1
    ? "Ese día hay un turno programado. Avisale al paciente y cancelalo o reprogramalo antes de cerrar el centro."
    : `Ese día hay ${count} turnos programados. Avisales a los pacientes y cancelalos o reprogramalos antes de cerrar el centro.`;
}

/// Cierre del centro por feriado o día excepcional (HU-14). Pide confirmación
/// con la fecha y la descripción antes de llamar a `createHoliday`. Con `date`
/// la fecha queda fija (el día que se ve en el calendario); sin ella se elige.
export function CloseCenterForm({ date }: { date?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [closedDate, setClosedDate] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<
    HolidayMutationState,
    FormData
  >(async (previous, formData) => {
    setClosedDate(null);
    const result = await createHoliday(previous, formData);
    if (result?.ok) {
      form.current?.reset();
      setClosedDate(String(formData.get("date")));
    }
    return result;
  }, null);

  const error = state?.ok === false ? state.error : undefined;
  const fieldErrors = error?.fieldErrors;
  const fieldError = (name: string) =>
    fieldErrors?.[name]?.[0] ??
    // Con la fecha fija no hay campo donde mostrar su error.
    (date && name === "description" ? fieldErrors?.date?.[0] : undefined);

  // Con la fecha fija, una vez cerrado el día no queda nada por cargar.
  if (date && closedDate) return <ClosedAlert date={closedDate} />;

  return (
    <>
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setConfirming({
            date: String(formData.get("date")),
            description: String(formData.get("description")).trim(),
            formData,
          });
        }}
        className="flex flex-col gap-4"
      >
        <div
          className={
            date
              ? "flex flex-col gap-3"
              : "grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-start"
          }
        >
          {date ? (
            <input type="hidden" name="date" value={date} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Fecha *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                min={getTodayDateString()}
                aria-invalid={Boolean(fieldErrors?.date)}
                className="tabular-nums"
              />
              {fieldErrors?.date && (
                <p className="text-destructive text-xs">
                  {fieldErrors.date[0]}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descripción *</Label>
            <Input
              id="description"
              name="description"
              required
              maxLength={120}
              placeholder="Feriado nacional, desinfección del centro…"
              aria-invalid={Boolean(fieldError("description"))}
            />
            {fieldError("description") && (
              <p className="text-destructive text-xs">
                {fieldError("description")}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={pending}
            className={date ? "self-end" : "sm:mt-6"}
          >
            {pending ? "Cerrando…" : "Cerrar el centro"}
          </Button>
        </div>
        <ActionErrorAlert
          // Los errores de un campo se muestran junto al campo.
          error={fieldErrors ? undefined : error}
          affectedMessage={closureMessage}
        />
        {!date && closedDate && <ClosedAlert date={closedDate} />}
      </form>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar el centro?</AlertDialogTitle>
            <AlertDialogDescription>
              El{" "}
              <span className="text-foreground font-medium">
                {confirming && formatDate(confirming.date)}
              </span>{" "}
              el centro queda cerrado todo el día por{" "}
              <span className="text-foreground font-medium">
                «{confirming?.description}»
              </span>
              . No se ofrecen turnos para ningún profesional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Volver</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                if (!confirming) return;
                const { formData } = confirming;
                setConfirming(null);
                startTransition(() => formAction(formData));
              }}
            >
              Cerrar el centro
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ClosedAlert({ date }: { date: string }) {
  return (
    <Alert
      role="status"
      className="bg-success-soft text-success-soft-foreground border-success-soft-border"
    >
      <CheckCircle2 />
      <AlertDescription className="text-success-soft-foreground">
        El centro quedó cerrado el {formatDate(date)}.
      </AlertDescription>
    </Alert>
  );
}
