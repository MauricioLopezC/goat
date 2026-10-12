"use client";

import {
  startTransition,
  useActionState,
  useState,
  type ReactNode,
} from "react";
import { Plus } from "lucide-react";

import { ActionErrorAlert } from "@/components/action-error-alert";
import { ConfirmDelete } from "@/components/confirm-delete";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMinute } from "@/lib/schedule";
import { getTodayDateString } from "@/lib/utils";
import {
  checkExceptionAffectedCount,
  createAvailabilityException,
  deleteAvailabilityException,
  type ScheduleMutationState,
} from "./actions";

export type ScheduleException = {
  id: number;
  startDate?: string;
  endDate?: string;
  date: string;
  startMinute: number | null;
  endMinute: number | null;
  reason: string;
  createdBy: { firstName: string; lastName: string };
};

function formatExceptionPeriod(exception: ScheduleException) {
  const start = exception.startDate ?? exception.date;
  const end = exception.endDate ?? exception.date;
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} al ${formatDate(end)}`;
}

function exceptionHours(exception: ScheduleException) {
  return exception.startMinute === null || exception.endMinute === null
    ? "Día completo"
    : `${formatMinute(exception.startMinute)}–${formatMinute(exception.endMinute)}`;
}

/// Excepciones de agenda del profesional (HU-05, HU-23): ausencias puntuales o
/// períodos de vacaciones que se descuentan del patrón semanal. Solo `MANAGER` las carga y elimina.
export function ExceptionsSection({
  professionalId,
  exceptions,
  canEdit,
}: {
  professionalId: number;
  exceptions: ScheduleException[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Excepciones de agenda</CardTitle>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdding(true)}
          >
            <Plus data-icon="inline-start" />
            Agregar excepción
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {exceptions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Sin ausencias cargadas de hoy en adelante.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Cargada por</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map((exception) => {
                const periodLabel = formatExceptionPeriod(exception);
                const hoursLabel = exceptionHours(exception);
                return (
                  <TableRow key={exception.id}>
                    <TableCell className="capitalize tabular-nums">
                      {periodLabel}
                    </TableCell>
                    <TableCell className="tabular-nums">{hoursLabel}</TableCell>
                    <TableCell className="whitespace-normal">
                      {exception.reason}
                    </TableCell>
                    <TableCell>
                      {exception.createdBy.firstName}{" "}
                      {exception.createdBy.lastName}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <ConfirmDelete
                          action={deleteAvailabilityException}
                          fields={{ id: exception.id, professionalId }}
                          title="Eliminar excepción"
                          description={`Durante ${periodLabel} (${hoursLabel.toLowerCase()}) vuelve a ofrecer los horarios de sus franjas.`}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          {adding && (
            <ExceptionForm
              professionalId={professionalId}
              onDone={() => setAdding(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

type PendingException = {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  reason: string;
  formData: FormData;
  affectedCount?: number | null;
};

function ExceptionForm({
  professionalId,
  onDone,
}: {
  professionalId: number;
  onDone: () => void;
}) {
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirming, setConfirming] = useState<PendingException | null>(null);
  const [state, formAction, pending] = useActionState<
    ScheduleMutationState,
    FormData
  >(async (previous, formData) => {
    const result = await createAvailabilityException(previous, formData);
    if (result?.ok) onDone();
    return result;
  }, null);

  const error = state?.ok === false ? state.error : undefined;
  const fieldErrors = error?.fieldErrors;

  return (
    <>
      <form
        // Con `onSubmit` el formulario no se vacía cuando la acción falla.
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const sDate = String(formData.get("startDate") || "");
          const eDate = String(formData.get("endDate") || sDate);
          const isAllDay = allDay;
          const sTime = isAllDay ? null : (formData.get("startTime") as string);
          const eTime = isAllDay ? null : (formData.get("endTime") as string);

          const countRes = await checkExceptionAffectedCount({
            professionalId,
            startDate: sDate,
            endDate: eDate,
            allDay: isAllDay,
            startTime: sTime,
            endTime: eTime,
          });
          const affectedCount = countRes.ok ? countRes.data.count : null;

          setConfirming({
            startDate: sDate,
            endDate: eDate,
            allDay: isAllDay,
            startTime: sTime,
            endTime: eTime,
            reason: String(formData.get("reason")).trim(),
            formData,
            affectedCount,
          });
        }}
        className="flex flex-col gap-4"
      >
        <DialogHeader>
          <DialogTitle>Agregar excepción</DialogTitle>
          <DialogDescription>
            Período u horario en que el profesional no atiende. No se puede
            cargar sobre turnos ya programados.
          </DialogDescription>
        </DialogHeader>

        <input type="hidden" name="professionalId" value={professionalId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Fecha inicio *"
            name="startDate"
            errors={fieldErrors?.startDate || fieldErrors?.date}
          >
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
              className="tabular-nums"
            />
          </Field>

          <Field
            label="Fecha fin *"
            name="endDate"
            errors={fieldErrors?.endDate}
          >
            <Input
              id="endDate"
              name="endDate"
              type="date"
              required
              min={startDate || getTodayDateString()}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="tabular-nums"
            />
          </Field>
        </div>

        <Label className="flex items-center gap-2 font-normal cursor-pointer">
          <Checkbox
            name="allDay"
            checked={allDay}
            onCheckedChange={(checked) => setAllDay(checked === true)}
          />
          <input
            type="hidden"
            name="allDay"
            value={allDay ? "true" : "false"}
          />
          Día completo
        </Label>

        {!allDay && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Desde *"
              name="startTime"
              errors={fieldErrors?.startTime}
            >
              <Input
                id="startTime"
                name="startTime"
                type="time"
                step={300}
                required
                className="tabular-nums"
              />
            </Field>
            <Field label="Hasta *" name="endTime" errors={fieldErrors?.endTime}>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                step={300}
                required
                className="tabular-nums"
              />
            </Field>
          </div>
        )}

        <Field label="Motivo *" name="reason" errors={fieldErrors?.reason}>
          <Input
            id="reason"
            name="reason"
            required
            maxLength={200}
            placeholder="Congreso, vacaciones, trámite personal…"
          />
        </Field>

        <ActionErrorAlert
          error={
            // Los errores de validación de un campo se muestran junto al campo.
            error?.code === "VALIDATION" && error.fieldErrors
              ? undefined
              : error
          }
        />

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar excepción"}
          </Button>
        </DialogFooter>
      </form>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Registrar ausencia del profesional?
            </AlertDialogTitle>
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
                " el profesional no atenderá en todo el día "
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
                «{confirming?.reason}»
              </span>
              . Durante ese período y horario no se ofrecerán turnos para este
              profesional.
            </AlertDialogDescription>
            {confirming?.affectedCount !== null &&
              confirming?.affectedCount !== undefined && (
                <div
                  className={
                    confirming.affectedCount > 0
                      ? "mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-xs text-amber-900 dark:text-amber-200"
                      : "mt-3 rounded-lg border border-border bg-muted/40 p-2.5 text-left text-xs text-muted-foreground"
                  }
                >
                  {confirming.affectedCount > 0 ? (
                    <>
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        ⚠️ Hay {confirming.affectedCount} turno
                        {confirming.affectedCount > 1 ? "s" : ""} programado
                        {confirming.affectedCount > 1 ? "s" : ""} en este
                        período y tramo.
                      </p>
                      <p className="mt-1">
                        El sistema no los cancela automáticamente. Deberán
                        cancelarse o reprogramarse antes de poder registrar la
                        ausencia.
                      </p>
                    </>
                  ) : (
                    <p>No hay turnos programados en este período y horario.</p>
                  )}
                </div>
              )}
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
              Confirmar ausencia
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors?.length ? (
        <p className="text-destructive text-xs">{errors[0]}</p>
      ) : null}
    </div>
  );
}
