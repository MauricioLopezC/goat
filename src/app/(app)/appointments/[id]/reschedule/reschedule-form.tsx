"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rescheduleAppointment } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActionErrorAlert } from "@/components/action-error-alert";
import type { ActionResult } from "@/lib/actions";
import type { AvailableSlot } from "@/lib/appointment-slots";
import {
  dateToDb,
  formatDate,
  formatMinute,
  toLocalSlot,
} from "@/lib/schedule";

type ProfessionalOption = {
  id: number;
  firstName: string;
  lastName: string;
};

type PatientInfo = {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
};

type ServiceInfo = {
  id: number;
  name: string;
};

const REQUESTED_BY_OPTIONS = [
  "El paciente",
  "El profesional",
  "El centro",
] as const;

export function RescheduleForm({
  appointmentId,
  patient,
  service,
  currentProfessional,
  currentStartsAt,
  currentEndsAt,
  professionals,
  selectedProfessionalId,
  availableDates,
  visibleDates,
  visibleDatePage,
  selectedDate,
  slots,
  availabilityError,
}: {
  appointmentId: number;
  patient: PatientInfo;
  service: ServiceInfo;
  currentProfessional: ProfessionalOption;
  currentStartsAt: string;
  currentEndsAt: string;
  professionals: ProfessionalOption[];
  selectedProfessionalId: number;
  availableDates: string[];
  visibleDates: string[];
  visibleDatePage: number;
  selectedDate: string;
  slots: AvailableSlot[];
  availabilityError: string;
}) {
  const router = useRouter();
  const [startTime, setStartTime] = useState("");
  const [reason, setReason] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validationError, setValidationError] = useState("");

  const [prevSelection, setPrevSelection] = useState({
    date: selectedDate,
    professionalId: selectedProfessionalId,
  });

  if (
    prevSelection.date !== selectedDate ||
    prevSelection.professionalId !== selectedProfessionalId
  ) {
    setPrevSelection({
      date: selectedDate,
      professionalId: selectedProfessionalId,
    });
    setStartTime("");
    setValidationError("");
  }

  const currentStartSlot = toLocalSlot(new Date(currentStartsAt));
  const currentEndSlot = toLocalSlot(new Date(currentEndsAt));

  const chosenProfessional =
    professionals.find((p) => p.id === selectedProfessionalId) ??
    currentProfessional;

  const chosenSlot = slots.find((s) => s.startTime === startTime);

  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number }> | null,
    FormData
  >(async () => {
    if (!startTime) {
      setValidationError("Elegí un horario disponible.");
      return null;
    }
    if (!reason.trim()) {
      setValidationError("El motivo de reprogramación es obligatorio.");
      return null;
    }
    if (!requestedBy.trim()) {
      setValidationError("Indicá quién solicitó la reprogramación.");
      return null;
    }

    const result = await rescheduleAppointment({
      appointmentId,
      newProfessionalId:
        selectedProfessionalId !== currentProfessional.id
          ? selectedProfessionalId
          : undefined,
      date: selectedDate,
      startTime,
      reason: reason.trim(),
      requestedBy: requestedBy.trim(),
    });

    if (result.ok) {
      setConfirmOpen(false);
      router.push(`/appointments/${appointmentId}?rescheduled=1`);
    } else {
      setConfirmOpen(false);
      if (
        result.error.code === "APPOINTMENT_OVERLAP" ||
        result.error.code === "PATIENT_APPOINTMENT_OVERLAP"
      ) {
        setStartTime("");
        router.refresh();
      }
    }
    return result;
  }, null);

  function handleProfessionalChange(newId: string) {
    const params = new URLSearchParams();
    if (newId && Number(newId) !== currentProfessional.id) {
      params.set("professionalId", newId);
    }
    setStartTime("");
    router.push(
      `/appointments/${appointmentId}/reschedule${params.toString() ? `?${params.toString()}` : ""}`,
      { scroll: false },
    );
  }

  function datesHref(page: number, date?: string) {
    const params = new URLSearchParams();
    if (selectedProfessionalId !== currentProfessional.id) {
      params.set("professionalId", String(selectedProfessionalId));
    }
    if (page > 1) params.set("datePage", String(page));
    if (date) params.set("date", date);
    return `/appointments/${appointmentId}/reschedule?${params.toString()}`;
  }

  function handleOpenConfirm(event: React.FormEvent) {
    event.preventDefault();
    setValidationError("");

    if (!selectedDate) {
      setValidationError("Elegí una fecha disponible.");
      return;
    }
    if (!startTime) {
      setValidationError("Elegí un horario disponible.");
      return;
    }
    if (!reason.trim()) {
      setValidationError("El motivo de reprogramación es obligatorio.");
      return;
    }
    if (!requestedBy.trim()) {
      setValidationError("Indicá quién solicitó la reprogramación.");
      return;
    }

    if (
      selectedProfessionalId === currentProfessional.id &&
      selectedDate === currentStartSlot.date &&
      startTime === formatMinute(currentStartSlot.minute)
    ) {
      setValidationError(
        "El nuevo horario o profesional debe ser diferente al actual.",
      );
      return;
    }

    setConfirmOpen(true);
  }

  const error = state && !state.ok ? state.error : undefined;

  return (
    <>
      <form
        onSubmit={handleOpenConfirm}
        className="flex flex-col gap-6"
        aria-busy={pending}
      >
        <ActionErrorAlert error={error} />

        {validationError && (
          <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border">
            <AlertDescription className="text-destructive-soft-foreground">
              {validationError}
            </AlertDescription>
          </Alert>
        )}

        {/* 1. Datos fijos y Horario actual */}
        <div className="rounded-lg border bg-card p-4 text-card-foreground">
          <h2 className="text-title-md font-semibold mb-3">Datos del turno</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Paciente</dt>
              <dd className="font-medium">
                {patient.lastName}, {patient.firstName} · {patient.documentType}{" "}
                {patient.documentNumber}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Servicio</dt>
              <dd className="font-medium">{service.name}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-sm">
                Horario y profesional actual
              </dt>
              <dd className="font-medium text-scheduled">
                {formatDate(currentStartSlot.date)}, de{" "}
                {formatMinute(currentStartSlot.minute)} a{" "}
                {formatMinute(currentEndSlot.minute)} con{" "}
                {currentProfessional.lastName}, {currentProfessional.firstName}
              </dd>
            </div>
          </dl>
        </div>

        {/* 2. Profesional */}
        <div className="rounded-lg border bg-card p-4 text-card-foreground flex flex-col gap-3">
          <h2 className="text-title-md font-semibold">1. Profesional</h2>
          {professionals.length <= 1 ? (
            <p className="text-sm">
              Atiende:{" "}
              <strong>
                {currentProfessional.lastName}, {currentProfessional.firstName}
              </strong>{" "}
              (único profesional habilitado para este servicio).
            </p>
          ) : (
            <Field>
              <FieldLabel htmlFor="reschedule-professional">
                Elegí un profesional para la atención
              </FieldLabel>
              <NativeSelect
                id="reschedule-professional"
                value={selectedProfessionalId}
                onChange={(event) =>
                  handleProfessionalChange(event.target.value)
                }
                disabled={pending}
                className="w-full"
              >
                {professionals.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.lastName}, {item.firstName}
                    {item.id === currentProfessional.id ? " (actual)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>

        {/* 3. Fecha */}
        <div className="rounded-lg border bg-card p-4 text-card-foreground flex flex-col gap-3">
          <h2 className="text-title-md font-semibold">2. Fecha</h2>
          {availabilityError ? (
            <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border">
              <AlertDescription className="text-destructive-soft-foreground">
                {availabilityError}
              </AlertDescription>
            </Alert>
          ) : availableDates.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay fechas disponibles en los próximos dos meses para este
              profesional.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Elegí una fecha para ver los horarios disponibles. El horario
                actual no cuenta como ocupado.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {visibleDates.map((dateStr) => (
                  <Button
                    key={dateStr}
                    asChild
                    variant={dateStr === selectedDate ? "default" : "outline"}
                    className="h-auto min-h-9.5 whitespace-normal text-center"
                  >
                    <Link
                      href={datesHref(visibleDatePage, dateStr)}
                      scroll={false}
                      prefetch={false}
                      aria-current={
                        dateStr === selectedDate ? "date" : undefined
                      }
                    >
                      {new Intl.DateTimeFormat("es-AR", {
                        weekday: "short",
                        day: "numeric",
                        month: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(dateToDb(dateStr))}
                      {dateStr === currentStartSlot.date ? " (hoy/actual)" : ""}
                    </Link>
                  </Button>
                ))}
              </div>
              {availableDates.length > 14 && (
                <nav
                  aria-label="Páginas de fechas disponibles"
                  className="flex items-center gap-3 pt-2"
                >
                  {visibleDatePage > 1 && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={datesHref(visibleDatePage - 1)}
                        scroll={false}
                      >
                        ← Fechas anteriores
                      </Link>
                    </Button>
                  )}
                  <span className="text-muted-foreground text-sm">
                    Página {visibleDatePage} de{" "}
                    {Math.ceil(availableDates.length / 14)}
                  </span>
                  {visibleDatePage * 14 < availableDates.length && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={datesHref(visibleDatePage + 1)}
                        scroll={false}
                      >
                        Más fechas →
                      </Link>
                    </Button>
                  )}
                </nav>
              )}
            </>
          )}
        </div>

        {/* 4. Horarios disponibles */}
        {selectedDate && (
          <div className="rounded-lg border bg-card p-4 text-card-foreground flex flex-col gap-4">
            <h2 className="text-title-md font-semibold">
              3. Horario para el {formatDate(selectedDate)}
            </h2>
            {slots.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    No hay horarios disponibles en esta fecha
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <FieldSet disabled={pending}>
                <FieldLegend>Elegí el nuevo horario</FieldLegend>
                <RadioGroup
                  aria-label="Horarios disponibles"
                  value={startTime}
                  onValueChange={setStartTime}
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                >
                  {slots.map((slot) => {
                    const isCurrent =
                      selectedDate === currentStartSlot.date &&
                      slot.startTime ===
                        formatMinute(currentStartSlot.minute) &&
                      selectedProfessionalId === currentProfessional.id;
                    return (
                      <Field
                        key={slot.startTime}
                        orientation="horizontal"
                        className={`rounded-lg border p-3 ${isCurrent ? "border-scheduled bg-scheduled-soft/40" : ""}`}
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
                          {isCurrent ? " (actual)" : ""}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </RadioGroup>
              </FieldSet>
            )}
          </div>
        )}

        {/* 5. Motivo y Solicitante */}
        <div className="rounded-lg border bg-card p-4 text-card-foreground flex flex-col gap-4">
          <h2 className="text-title-md font-semibold">4. Motivo y solicitud</h2>
          <Field>
            <FieldLabel htmlFor="reschedule-reason">
              Motivo de la reprogramación *
            </FieldLabel>
            <Textarea
              id="reschedule-reason"
              required
              maxLength={500}
              rows={3}
              placeholder="Ej.: el paciente llamó para solicitar cambio por superposición laboral"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="reschedule-requestedBy">
              Quién solicitó el cambio *
            </FieldLabel>
            <NativeSelect
              id="reschedule-requestedBy"
              required
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              disabled={pending}
              className="w-full"
            >
              <NativeSelectOption value="">
                Seleccioná quién solicitó el cambio…
              </NativeSelectOption>
              {REQUESTED_BY_OPTIONS.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={pending || !selectedDate || !startTime}
          >
            Continuar a confirmación
          </Button>
          <Button asChild variant="outline" disabled={pending}>
            <Link href={`/appointments/${appointmentId}`}>
              Cancelar y volver
            </Link>
          </Button>
        </div>
      </form>

      {/* Diálogo de Confirmación */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Confirmar reprogramación del turno?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-3 pt-2 text-foreground text-sm">
                <p className="text-muted-foreground">
                  Revisá los datos antes de confirmar. El horario anterior
                  quedará liberado de inmediato y se registrará el nuevo
                  horario.
                </p>
                <div className="rounded-md border p-3 flex flex-col gap-2">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">
                      Horario anterior:
                    </span>
                    <p className="font-medium text-destructive">
                      {formatDate(currentStartSlot.date)}, de{" "}
                      {formatMinute(currentStartSlot.minute)} a{" "}
                      {formatMinute(currentEndSlot.minute)} con{" "}
                      {currentProfessional.lastName},{" "}
                      {currentProfessional.firstName}
                    </p>
                  </div>
                  <div className="border-t pt-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">
                      Nuevo horario:
                    </span>
                    <p className="font-semibold text-primary">
                      {selectedDate ? formatDate(selectedDate) : ""}, de{" "}
                      {startTime} a {chosenSlot?.endTime} con{" "}
                      {chosenProfessional.lastName},{" "}
                      {chosenProfessional.firstName}
                    </p>
                  </div>
                </div>

                <div className="text-sm">
                  <p>
                    <strong>Motivo:</strong> {reason}
                  </p>
                  <p>
                    <strong>Solicitó:</strong> {requestedBy}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Volver
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(() => {
                  formAction(new FormData());
                });
              }}
            >
              {pending ? "Reprogramando…" : "Confirmar reprogramación"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
