"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldError,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ActionErrorAlert } from "@/components/action-error-alert";
import type { ActionResult } from "@/lib/actions";
import type { AvailableSlot } from "@/lib/appointment-slots";
import type { AvailableSlotsInput } from "@/lib/validation/appointments";
import { formatDate } from "@/lib/schedule";

export function AppointmentForm({
  input,
  slots,
  initialStartTime,
  patientName,
  serviceName,
  professionalName,
}: {
  input: AvailableSlotsInput;
  slots: AvailableSlot[];
  /** Hora precargada desde un bloque libre del calendario (HU-11). */
  initialStartTime?: string;
  patientName: string;
  serviceName: string;
  professionalName: string;
}) {
  const router = useRouter();
  const [startTime, setStartTime] = useState(initialStartTime ?? "");
  const [notes, setNotes] = useState("");
  const [state, action, pending] = useActionState<
    ActionResult<{ id: number }> | null,
    FormData
  >(async () => {
    const result = await createAppointment({ ...input, startTime, notes });
    if (result.ok) router.push(`/appointments/${result.data.id}?created=1`);
    else {
      setStartTime("");
      router.refresh();
    }
    return result;
  }, null);
  const chosenSlot = slots.find((slot) => slot.startTime === startTime);
  const error = state && !state.ok ? state.error : undefined;
  return (
    <form action={action} className="flex flex-col gap-5" aria-busy={pending}>
      <ActionErrorAlert error={error} />
      {slots.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No hay horarios disponibles</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <FieldSet disabled={pending}>
          <FieldLegend>4. Elegí el horario</FieldLegend>
          <RadioGroup
            aria-label="Horarios disponibles"
            value={chosenSlot?.startTime ?? ""}
            onValueChange={setStartTime}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {slots.map((slot) => (
              <Field
                key={slot.startTime}
                orientation="horizontal"
                className="rounded-lg border p-3"
              >
                <RadioGroupItem
                  id={`slot-${slot.startTime}`}
                  value={slot.startTime}
                />
                <FieldLabel
                  htmlFor={`slot-${slot.startTime}`}
                  className="tabular-nums"
                >
                  {slot.startTime}–{slot.endTime}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
      )}
      <FieldGroup>
        <Field data-invalid={Boolean(error?.fieldErrors?.notes)}>
          <FieldLabel htmlFor="appointment-notes">
            Observación breve (opcional)
          </FieldLabel>
          <Textarea
            id="appointment-notes"
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={pending}
            aria-invalid={Boolean(error?.fieldErrors?.notes)}
          />
          <FieldError>{error?.fieldErrors?.notes?.join(" ")}</FieldError>
        </Field>
      </FieldGroup>
      {chosenSlot && (
        <Alert>
          <AlertDescription>
            <p>
              <strong>{patientName}</strong> · {serviceName} ·{" "}
              {professionalName}
            </p>
            <p>
              {formatDate(input.date)}, de {chosenSlot.startTime} a{" "}
              {chosenSlot.endTime}.
            </p>
          </AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        disabled={pending || !chosenSlot || Boolean(state?.ok)}
        className="self-start"
      >
        {pending ? "Confirmando…" : "Confirmar turno"}
      </Button>
    </form>
  );
}
