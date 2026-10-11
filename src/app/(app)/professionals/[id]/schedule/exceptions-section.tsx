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
    <form
      // Con `onSubmit` el formulario no se vacía cuando la acción falla.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>Agregar excepción</DialogTitle>
        <DialogDescription>
          Período u horario en que el profesional no atiende. No se puede cargar
          sobre turnos ya programados.
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

        <Field label="Fecha fin *" name="endDate" errors={fieldErrors?.endDate}>
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

      <Label className="flex items-center gap-2 font-normal">
        <Checkbox
          name="allDay"
          checked={allDay}
          onCheckedChange={(checked) => setAllDay(checked === true)}
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
          error?.code === "VALIDATION" && error.fieldErrors ? undefined : error
        }
      />

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar excepción"}
        </Button>
      </DialogFooter>
    </form>
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
