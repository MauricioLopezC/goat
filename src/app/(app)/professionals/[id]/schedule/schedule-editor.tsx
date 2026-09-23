"use client";

import { startTransition, useActionState, useState } from "react";
import { Plus } from "lucide-react";

import { ActionErrorAlert } from "@/components/action-error-alert";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  WeeklySchedule,
  type ScheduleWindow,
} from "@/components/weekly-schedule";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEEKDAYS, WEEKDAY_LABEL, formatMinute } from "@/lib/schedule";
import {
  deleteAvailabilityWindow,
  saveAvailabilityWindow,
  type ScheduleMutationState,
} from "./actions";

type Option = { id: number; name: string };

export type EditableWindow = Omit<ScheduleWindow, "room" | "services"> & {
  room: Option | null;
  services: Option[];
};

/// Sin consultorio. Radix Select no admite un ítem con valor vacío.
const NO_ROOM = "none";

/// El pie del diálogo queda fuera del formulario: el borrado tiene su propio
/// formulario y no puede anidarse (ni burbujear su envío) en este.
const FORM_ID = "availability-window-form";

/// Franjas del patrón semanal con alta, modificación y baja (HU-05, solo
/// `MANAGER`). Cada franja de la vista semanal abre su edición.
export function ScheduleEditor({
  professionalId,
  active,
  windows,
  services,
  rooms,
}: {
  professionalId: number;
  active: boolean;
  windows: EditableWindow[];
  services: Option[];
  rooms: Option[];
}) {
  // `undefined`: cerrado. `null`: alta. Una franja: su edición.
  const [editing, setEditing] = useState<EditableWindow | null | undefined>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {active
            ? "Hacé clic en una franja para modificarla o eliminarla."
            : "El profesional está inactivo: no se le pueden cargar ni modificar franjas. Sí se pueden eliminar."}
        </p>
        {active && (
          <Button type="button" onClick={() => setEditing(null)}>
            <Plus data-icon="inline-start" />
            Agregar franja
          </Button>
        )}
      </div>

      <WeeklySchedule
        windows={windows}
        wrapWindow={(window, content) => (
          <button
            type="button"
            onClick={() => setEditing(window)}
            aria-label={`Editar franja del ${WEEKDAY_LABEL[window.weekday].toLowerCase()} de ${formatMinute(window.startMinute)} a ${formatMinute(window.endMinute)}`}
            className="focus-visible:ring-ring/50 block size-full cursor-pointer rounded-lg outline-none focus-visible:ring-3"
          >
            {content}
          </button>
        )}
      />

      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {editing !== undefined && (
            <WindowForm
              professionalId={professionalId}
              active={active}
              window={editing}
              services={services}
              rooms={rooms}
              onDone={() => setEditing(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WindowForm({
  professionalId,
  active,
  window,
  services,
  rooms,
  onDone,
}: {
  professionalId: number;
  active: boolean;
  window: EditableWindow | null;
  services: Option[];
  rooms: Option[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ScheduleMutationState,
    FormData
  >(async (previous, formData) => {
    const result = await saveAvailabilityWindow(previous, formData);
    if (result?.ok) onDone();
    return result;
  }, null);

  const error = state?.ok === false ? state.error : undefined;
  const fieldErrors = error?.code === "VALIDATION" ? error.fieldErrors : {};
  const enabledIds = new Set(window?.services.map((service) => service.id));

  return (
    <>
      <form
        id={FORM_ID}
        // Con `onSubmit` el formulario no se vacía cuando la acción falla.
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4"
      >
        <DialogHeader>
          <DialogTitle>
            {window ? "Modificar franja" : "Agregar franja"}
          </DialogTitle>
          <DialogDescription>
            La franja se repite todas las semanas hasta que se modifique.
          </DialogDescription>
        </DialogHeader>

        <input type="hidden" name="professionalId" value={professionalId} />
        {window && <input type="hidden" name="id" value={window.id} />}

        <fieldset disabled={!active} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="weekday">Día *</Label>
              <Select name="weekday" defaultValue={window?.weekday ?? "MONDAY"}>
                <SelectTrigger id="weekday" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((weekday) => (
                    <SelectItem key={weekday} value={weekday}>
                      {WEEKDAY_LABEL[weekday]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TimeField
              name="startTime"
              label="Desde *"
              defaultValue={window ? formatMinute(window.startMinute) : "09:00"}
              errors={fieldErrors?.startTime}
            />
            <TimeField
              name="endTime"
              label="Hasta *"
              defaultValue={window ? formatMinute(window.endMinute) : "13:00"}
              errors={fieldErrors?.endTime}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roomId">Consultorio</Label>
            <Select
              name="roomId"
              defaultValue={window?.room ? String(window.room.id) : NO_ROOM}
            >
              <SelectTrigger id="roomId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROOM}>
                  Sin consultorio asignado
                </SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={String(room.id)}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              Servicios habilitados
            </legend>
            <p className="text-muted-foreground text-xs">
              Sin marcar ninguno, la franja admite todos los servicios del
              profesional.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((service) => (
                <Label
                  key={service.id}
                  className="flex items-center gap-2 font-normal"
                >
                  <Checkbox
                    name="serviceIds"
                    value={String(service.id)}
                    defaultChecked={enabledIds.has(service.id)}
                  />
                  {service.name}
                </Label>
              ))}
            </div>
          </fieldset>
        </fieldset>
      </form>

      <ActionErrorAlert
        error={
          // Los errores de validación de un campo se muestran junto al campo.
          error?.code === "VALIDATION" && error.fieldErrors ? undefined : error
        }
      />

      <DialogFooter className="sm:justify-between">
        {window ? (
          <ConfirmDelete
            action={deleteAvailabilityWindow}
            fields={{ id: window.id, professionalId }}
            title="Eliminar franja"
            description={`Se eliminará la franja del ${WEEKDAY_LABEL[window.weekday].toLowerCase()} de ${formatMinute(window.startMinute)} a ${formatMinute(window.endMinute)}. No se puede eliminar si deja turnos programados fuera de horario.`}
            onDeleted={onDone}
          />
        ) : (
          <span />
        )}
        {active && (
          <Button type="submit" form={FORM_ID} disabled={pending}>
            {pending ? "Guardando…" : "Guardar franja"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function TimeField({
  name,
  label,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  defaultValue: string;
  errors?: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="time"
        step={300}
        required
        defaultValue={defaultValue}
        aria-invalid={Boolean(errors?.length)}
        className="tabular-nums"
      />
      {errors?.length ? (
        <p className="text-destructive text-xs">{errors[0]}</p>
      ) : null}
    </div>
  );
}
