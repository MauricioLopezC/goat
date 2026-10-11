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

type Pending = {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  description: string;
  formData: FormData;
};

function closureMessage(count: number) {
  return count === 1
    ? "En ese período hay un turno programado. Avisale al paciente y cancelalo o reprogramalo antes de cerrar el centro."
    : `En ese período hay ${count} turnos programados. Avisales a los pacientes y cancelalos o reprogramalos antes de cerrar el centro.`;
}

/// Cierre del centro por feriado o día excepcional (HU-14, HU-23). Pide confirmación
/// con el período, horario y descripción antes de llamar a `createHoliday`. Con `date`
/// prellena el día que se ve en el calendario; sin ella se eligen las fechas.
export function CloseCenterForm({ date }: { date?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [closedInfo, setClosedInfo] = useState<{
    startDate: string;
    endDate: string;
    allDay: boolean;
    startTime?: string | null;
    endTime?: string | null;
  } | null>(null);
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(date ?? "");
  const [endDate, setEndDate] = useState(date ?? "");

  const [state, formAction, pending] = useActionState<
    HolidayMutationState,
    FormData
  >(async (previous, formData) => {
    setClosedInfo(null);
    const result = await createHoliday(previous, formData);
    if (result?.ok) {
      const sDate = String(formData.get("startDate") || formData.get("date"));
      const eDate = String(
        formData.get("endDate") || formData.get("startDate") || sDate,
      );
      const isAllDay =
        formData.get("allDay") === "on" || formData.get("allDay") === "true";
      form.current?.reset();
      setClosedInfo({
        startDate: sDate,
        endDate: eDate,
        allDay: isAllDay,
        startTime: formData.get("startTime") as string | null,
        endTime: formData.get("endTime") as string | null,
      });
    }
    return result;
  }, null);

  const error = state?.ok === false ? state.error : undefined;
  const fieldErrors = error?.fieldErrors;
  const fieldError = (name: string) => fieldErrors?.[name]?.[0];

  if (date && closedInfo) return <ClosedAlert info={closedInfo} />;

  return (
    <>
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const sDate = String(
            formData.get("startDate") || formData.get("date") || date,
          );
          const eDate = String(
            formData.get("endDate") ||
              formData.get("startDate") ||
              formData.get("date") ||
              date,
          );
          const isAllDay = allDay;
          setConfirming({
            startDate: sDate,
            endDate: eDate,
            allDay: isAllDay,
            startTime: isAllDay ? null : (formData.get("startTime") as string),
            endTime: isAllDay ? null : (formData.get("endTime") as string),
            description: String(formData.get("description")).trim(),
            formData,
          });
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">Fecha inicio *</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              min={getTodayDateString()}
              value={startDate}
              onChange={(e) => {
                const val = e.target.value;
                setStartDate(val);
                if (!endDate || endDate < val) {
                  setEndDate(val);
                }
              }}
              aria-invalid={Boolean(
                fieldErrors?.startDate || fieldErrors?.date,
              )}
              className="tabular-nums"
            />
            {(fieldErrors?.startDate || fieldErrors?.date) && (
              <p className="text-destructive text-xs">
                {fieldErrors?.startDate?.[0] || fieldErrors?.date?.[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">Fecha fin *</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              required
              min={startDate || getTodayDateString()}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-invalid={Boolean(fieldErrors?.endDate)}
              className="tabular-nums"
            />
            {fieldErrors?.endDate && (
              <p className="text-destructive text-xs">
                {fieldErrors.endDate[0]}
              </p>
            )}
          </div>
        </div>

        <Label className="flex items-center gap-2 font-normal">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Día completo
        </Label>

        {!allDay && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startTime">Desde *</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                step={300}
                required
                aria-invalid={Boolean(fieldErrors?.startTime)}
                className="tabular-nums"
              />
              {fieldErrors?.startTime && (
                <p className="text-destructive text-xs">
                  {fieldErrors.startTime[0]}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endTime">Hasta *</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                step={300}
                required
                aria-invalid={Boolean(fieldErrors?.endTime)}
                className="tabular-nums"
              />
              {fieldErrors?.endTime && (
                <p className="text-destructive text-xs">
                  {fieldErrors.endTime[0]}
                </p>
              )}
            </div>
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

        <Button type="submit" disabled={pending} className="sm:self-end">
          {pending ? "Cerrando…" : "Cerrar el centro"}
        </Button>

        <ActionErrorAlert
          error={fieldErrors ? undefined : error}
          affectedMessage={closureMessage}
        />
        {!date && closedInfo && <ClosedAlert info={closedInfo} />}
      </form>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar el centro?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.startDate === confirming?.endDate ? (
                <>
                  El{" "}
                  <span className="text-foreground font-medium">
                    {confirming && formatDate(confirming.startDate)}
                  </span>
                </>
              ) : (
                <>
                  Del{" "}
                  <span className="text-foreground font-medium">
                    {confirming && formatDate(confirming.startDate)}
                  </span>{" "}
                  al{" "}
                  <span className="text-foreground font-medium">
                    {confirming && formatDate(confirming.endDate)}
                  </span>
                </>
              )}
              {confirming?.allDay ? (
                " el centro queda cerrado todo el día "
              ) : (
                <>
                  {" "}
                  de{" "}
                  <span className="text-foreground font-medium">
                    {confirming?.startTime}
                  </span>{" "}
                  a{" "}
                  <span className="text-foreground font-medium">
                    {confirming?.endTime}
                  </span>{" "}
                  cada día{" "}
                </>
              )}
              por{" "}
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

function ClosedAlert({
  info,
}: {
  info: {
    startDate: string;
    endDate: string;
    allDay: boolean;
    startTime?: string | null;
    endTime?: string | null;
  };
}) {
  const periodText =
    info.startDate === info.endDate
      ? `el ${formatDate(info.startDate)}`
      : `del ${formatDate(info.startDate)} al ${formatDate(info.endDate)}`;
  const hoursText = info.allDay
    ? "todo el día"
    : `de ${info.startTime} a ${info.endTime}`;

  return (
    <Alert
      role="status"
      className="bg-success-soft text-success-soft-foreground border-success-soft-border"
    >
      <CheckCircle2 />
      <AlertDescription className="text-success-soft-foreground">
        El centro quedó cerrado {periodText} ({hoursText}).
      </AlertDescription>
    </Alert>
  );
}
