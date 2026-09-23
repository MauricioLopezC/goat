"use client";

import { startTransition, useActionState, useRef } from "react";

import { ActionErrorAlert } from "@/components/action-error-alert";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate } from "@/lib/schedule";
import { getTodayDateString } from "@/lib/utils";
import {
  createHoliday,
  deleteHoliday,
  type HolidayMutationState,
} from "./actions";

type Holiday = { id: number; date: string; description: string };

/// Feriados de hoy en adelante (HU-05). Solo `MANAGER` los carga y elimina.
export function HolidaysManager({
  holidays,
  canEdit,
}: {
  holidays: Holiday[];
  canEdit: boolean;
}) {
  return (
    <>
      {canEdit && <HolidayForm />}

      <Card>
        <CardHeader>
          <CardTitle>Próximos feriados</CardTitle>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay feriados cargados de hoy en adelante.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  {canEdit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="capitalize tabular-nums">
                      {formatDate(holiday.date)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {holiday.description}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <ConfirmDelete
                          action={deleteHoliday}
                          fields={{ id: holiday.id }}
                          title="Eliminar feriado"
                          description={`El ${formatDate(holiday.date)} el centro vuelve a ofrecer turnos según las franjas de cada profesional.`}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function HolidayForm() {
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    HolidayMutationState,
    FormData
  >(async (previous, formData) => {
    const result = await createHoliday(previous, formData);
    if (result?.ok) form.current?.reset();
    return result;
  }, null);

  const error = state?.ok === false ? state.error : undefined;
  const fieldErrors = error?.fieldErrors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agregar feriado</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={form}
          // Con `onSubmit` el formulario no se vacía cuando la acción falla.
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => formAction(formData));
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Descripción *</Label>
              <Input
                id="description"
                name="description"
                required
                maxLength={120}
                placeholder="Día de la Soberanía Nacional"
                aria-invalid={Boolean(fieldErrors?.description)}
              />
              {fieldErrors?.description && (
                <p className="text-destructive text-xs">
                  {fieldErrors.description[0]}
                </p>
              )}
            </div>
            <Button type="submit" disabled={pending} className="sm:mt-6">
              {pending ? "Guardando…" : "Agregar"}
            </Button>
          </div>
          <ActionErrorAlert
            error={
              // Los errores de un campo se muestran junto al campo.
              error?.fieldErrors ? undefined : error
            }
          />
        </form>
      </CardContent>
    </Card>
  );
}
