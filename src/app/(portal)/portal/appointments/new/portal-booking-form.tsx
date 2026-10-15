"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Stethoscope,
  UserRound,
} from "lucide-react";
import type {
  EarliestSlot,
  PortalBookingOptions,
} from "@/lib/dal/appointments";
import { formatDate } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  bookPortalAppointment,
  getAvailableDatesAction,
  getAvailableSlotsAction,
  getEarliestSlotsAction,
} from "../../actions";

type PendingSlot = {
  service: PortalBookingOptions["services"][number];
  professional: {
    id: number;
    firstName: string;
    lastName: string;
    licenseNumber?: string;
  };
  date: string;
  startTime: string;
  endTime: string;
};

export function PortalBookingForm({
  options,
}: {
  options: PortalBookingOptions;
}) {
  const router = useRouter();

  // Paso 1: Servicio seleccionado
  const [selectedServiceId, setSelectedServiceId] = useState<number>(
    options.services[0]?.id ?? 0,
  );

  // Paso 2: Modo de búsqueda
  const [searchMode, setSearchMode] = useState<"earliest" | "custom">(
    "earliest",
  );

  // Estado modo "earliest"
  const [earliestSlots, setEarliestSlots] = useState<EarliestSlot[]>([]);
  const [loadingEarliest, startEarliestTransition] = useTransition();
  const [earliestError, setEarliestError] = useState<string | null>(null);

  // Estado modo "custom"
  const [selectedProfessionalId, setSelectedProfessionalId] =
    useState<number>(0);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, startDatesTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<
    { startTime: string; endTime: string }[]
  >([]);
  const [loadingSlots, startSlotsTransition] = useTransition();

  // Estado diálogo de confirmación
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);
  const [isConfirming, startTransition] = useTransition();
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const selectedService =
    options.services.find((s) => s.id === selectedServiceId) ??
    options.services[0];

  // Profesionales que prestan el servicio seleccionado
  const matchingProfessionals = options.professionals.filter((p) =>
    p.services.some((s) => s.id === selectedServiceId),
  );

  const handleSelectService = (id: number) => {
    if (id === selectedServiceId) return;
    setSelectedServiceId(id);
    setSelectedProfessionalId(0);
    setAvailableDates([]);
    setSelectedDate("");
    setAvailableSlots([]);
  };

  const handleSelectProfessional = (profId: number) => {
    setSelectedProfessionalId(profId);
    setSelectedDate("");
    setAvailableSlots([]);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setAvailableSlots([]);
  };

  // Carga de turnos más tempranos cuando cambia el servicio o se entra a "earliest"
  useEffect(() => {
    if (searchMode !== "earliest" || !selectedServiceId) return;

    let active = true;
    startEarliestTransition(async () => {
      const res = await getEarliestSlotsAction({
        serviceId: selectedServiceId,
        patientId: options.patient.id,
        limit: 6,
      });
      if (!active) return;
      if (res.ok) {
        setEarliestSlots(res.data);
        setEarliestError(null);
      } else {
        setEarliestSlots([]);
        setEarliestError(res.error.message);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedServiceId, searchMode, options.patient.id]);

  // Carga de fechas disponibles cuando se elige un profesional
  useEffect(() => {
    if (
      searchMode !== "custom" ||
      !selectedProfessionalId ||
      !selectedServiceId
    ) {
      return;
    }

    let active = true;
    startDatesTransition(async () => {
      const res = await getAvailableDatesAction({
        professionalId: selectedProfessionalId,
        serviceId: selectedServiceId,
        patientId: options.patient.id,
      });
      if (!active) return;
      if (res.ok) {
        setAvailableDates(res.data);
      } else {
        setAvailableDates([]);
      }
    });

    return () => {
      active = false;
    };
  }, [
    selectedProfessionalId,
    selectedServiceId,
    searchMode,
    options.patient.id,
  ]);

  // Carga de horarios cuando se elige una fecha
  useEffect(() => {
    if (!selectedDate || !selectedProfessionalId || !selectedServiceId) {
      return;
    }

    let active = true;
    startSlotsTransition(async () => {
      const res = await getAvailableSlotsAction({
        professionalId: selectedProfessionalId,
        serviceId: selectedServiceId,
        patientId: options.patient.id,
        date: selectedDate,
      });
      if (!active) return;
      if (res.ok) {
        setAvailableSlots(res.data);
      } else {
        setAvailableSlots([]);
      }
    });

    return () => {
      active = false;
    };
  }, [
    selectedDate,
    selectedProfessionalId,
    selectedServiceId,
    options.patient.id,
  ]);

  // Confirmar reserva
  const handleConfirmBooking = () => {
    if (!pendingSlot) return;

    setConfirmError(null);
    startTransition(async () => {
      const res = await bookPortalAppointment({
        patientId: options.patient.id,
        serviceId: pendingSlot.service.id,
        professionalId: pendingSlot.professional.id,
        date: pendingSlot.date,
        startTime: pendingSlot.startTime,
        priority: "NORMAL",
      });

      if (res.ok) {
        router.push("/portal");
      } else {
        setConfirmError(res.error.message);
        // Si el horario se ocupó, refrescar según el modo
        if (
          res.error.code === "APPOINTMENT_OVERLAP" ||
          res.error.code === "OUTSIDE_AVAILABILITY_WINDOW"
        ) {
          if (searchMode === "earliest") {
            getEarliestSlotsAction({
              serviceId: selectedServiceId,
              patientId: options.patient.id,
              limit: 6,
            }).then((r) => {
              if (r.ok) setEarliestSlots(r.data);
            });
          } else if (selectedDate && selectedProfessionalId) {
            getAvailableSlotsAction({
              professionalId: selectedProfessionalId,
              serviceId: selectedServiceId,
              patientId: options.patient.id,
              date: selectedDate,
            }).then((r) => {
              if (r.ok) setAvailableSlots(r.data);
            });
          }
        }
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Paso 1: Selección de Prestación */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-title-lg font-semibold text-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          <h2>Elegí la prestación</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.services.map((service) => {
            const isSelected = service.id === selectedServiceId;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => handleSelectService(service.id)}
                className={cn(
                  "flex flex-col justify-between rounded-xl border p-4 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary"
                    : "border-border bg-card hover:border-border-strong hover:bg-muted/10",
                )}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-body-md font-semibold text-foreground">
                      {service.name}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    )}
                  </div>

                  {service.specialty && (
                    <span className="text-label-sm font-medium text-muted-foreground uppercase">
                      {service.specialty.name}
                    </span>
                  )}

                  {service.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {service.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3.5" />
                    {service.durationMinutes} min
                  </span>

                  {options.patient.coverageType === "PRIVATE" ? (
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {service.price !== null
                        ? `$ ${service.price.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "A consultar"}
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-xs font-normal">
                      Obra social
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Paso 2: Selección de Horario */}
      {selectedService && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-title-lg font-semibold text-foreground">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            <h2>Elegí cómo querés buscar tu turno</h2>
          </div>

          {/* Selector de modo */}
          <div className="flex rounded-xl border border-border bg-muted/20 p-1">
            <button
              type="button"
              onClick={() => setSearchMode("earliest")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-body-sm font-medium transition-all",
                searchMode === "earliest"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarClock className="size-4 text-primary" />
              Primer horario disponible
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("custom")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-body-sm font-medium transition-all",
                searchMode === "custom"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarDays className="size-4 text-primary" />
              Elegir profesional y fecha
            </button>
          </div>

          {/* Contenido según el modo */}
          {searchMode === "earliest" ? (
            <Card className="rounded-xl border-border bg-card shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-title-md text-foreground">
                  Próximos horarios libres para {selectedService.name}
                </CardTitle>
                <CardDescription>
                  Horarios más próximos entre todos los profesionales que
                  brindan esta atención.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEarliest ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="size-5 animate-spin text-primary" />
                    <span>Buscando los primeros horarios libres...</span>
                  </div>
                ) : earliestError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{earliestError}</AlertDescription>
                  </Alert>
                ) : earliestSlots.length === 0 ? (
                  <Empty className="border-0 bg-transparent py-8">
                    <EmptyHeader>
                      <EmptyTitle>No hay horarios libres próximos</EmptyTitle>
                      <EmptyDescription className="max-w-md text-balance text-body-sm text-muted-foreground">
                        No encontramos turnos disponibles para este servicio en
                        los próximos dos meses. Probá seleccionando otro
                        servicio o consultá con recepción.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {earliestSlots.map((slot, index) => {
                      const dateLabel = formatDate(slot.date);
                      const prof = options.professionals.find(
                        (p) => p.id === slot.professional.id,
                      );
                      return (
                        <div
                          key={`${slot.date}-${slot.startTime}-${slot.professional.id}-${index}`}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50"
                        >
                          <div className="space-y-1">
                            <span className="text-body-md font-semibold text-foreground">
                              {dateLabel}
                            </span>
                            <div className="flex items-center gap-2 text-title-md font-bold text-primary tabular-nums">
                              <Clock className="size-4 shrink-0" />
                              <span>
                                {slot.startTime}–{slot.endTime} hs
                              </span>
                            </div>
                            <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
                              <UserRound className="size-3.5 shrink-0" />
                              <span>
                                Dr/Dra. {slot.professional.lastName},{" "}
                                {slot.professional.firstName}
                              </span>
                            </p>
                          </div>

                          <Button
                            size="sm"
                            onClick={() =>
                              setPendingSlot({
                                service: selectedService,
                                professional: {
                                  id: slot.professional.id,
                                  firstName: slot.professional.firstName,
                                  lastName: slot.professional.lastName,
                                  licenseNumber: prof?.licenseNumber,
                                },
                                date: slot.date,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                              })
                            }
                            className="mt-1 w-full gap-1.5"
                          >
                            Elegir este turno
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl border-border bg-card shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-title-md text-foreground">
                  Selección personalizada
                </CardTitle>
                <CardDescription>
                  Elegí con qué profesional querés atenderte y qué día te
                  resulta más cómodo.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {/* 1. Selector de profesional */}
                <Field className="space-y-1.5">
                  <FieldLabel htmlFor="professionalSelect">
                    Profesional
                  </FieldLabel>
                  <NativeSelect
                    id="professionalSelect"
                    value={selectedProfessionalId || ""}
                    onChange={(e) =>
                      handleSelectProfessional(Number(e.target.value) || 0)
                    }
                  >
                    <NativeSelectOption value="">
                      -- Seleccioná un profesional --
                    </NativeSelectOption>
                    {matchingProfessionals.map((prof) => (
                      <NativeSelectOption key={prof.id} value={prof.id}>
                        {prof.lastName}, {prof.firstName} (Mat.{" "}
                        {prof.licenseNumber})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {matchingProfessionals.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No hay profesionales activos con agenda disponible para
                      este servicio.
                    </p>
                  )}
                </Field>

                {/* 2. Selector de fecha */}
                {selectedProfessionalId > 0 && (
                  <Field className="space-y-1.5">
                    <FieldLabel htmlFor="dateSelect">
                      Día de atención
                    </FieldLabel>
                    {loadingDates ? (
                      <div className="flex items-center gap-2 py-2 text-body-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin text-primary" />
                        <span>Consultando fechas disponibles...</span>
                      </div>
                    ) : availableDates.length === 0 ? (
                      <p className="text-xs text-warning-soft-foreground rounded-lg border border-warning-soft-border bg-warning-soft p-3">
                        El profesional seleccionado no tiene fechas libres para
                        este servicio en los próximos dos meses.
                      </p>
                    ) : (
                      <NativeSelect
                        id="dateSelect"
                        value={selectedDate}
                        onChange={(e) => handleSelectDate(e.target.value)}
                      >
                        <NativeSelectOption value="">
                          -- Seleccioná una fecha disponible (
                          {availableDates.length}) --
                        </NativeSelectOption>
                        {availableDates.map((date) => (
                          <NativeSelectOption key={date} value={date}>
                            {formatDate(date)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </Field>
                )}

                {/* 3. Selector de horario */}
                {selectedDate && (
                  <div className="space-y-2 pt-2">
                    <FieldLabel>Horarios disponibles</FieldLabel>
                    {loadingSlots ? (
                      <div className="flex items-center gap-2 py-4 text-body-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin text-primary" />
                        <span>
                          Calculando horarios libres para el día elegido...
                        </span>
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No quedaron horarios disponibles en esta fecha.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {availableSlots.map((slot) => {
                          const prof = matchingProfessionals.find(
                            (p) => p.id === selectedProfessionalId,
                          );
                          return (
                            <Button
                              key={`${selectedDate}-${slot.startTime}`}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (prof) {
                                  setPendingSlot({
                                    service: selectedService,
                                    professional: {
                                      id: prof.id,
                                      firstName: prof.firstName,
                                      lastName: prof.lastName,
                                      licenseNumber: prof.licenseNumber,
                                    },
                                    date: selectedDate,
                                    startTime: slot.startTime,
                                    endTime: slot.endTime,
                                  });
                                }
                              }}
                              className="font-mono text-body-sm font-medium hover:border-primary hover:bg-primary/5 hover:text-primary"
                            >
                              {slot.startTime} hs
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Diálogo de Confirmación */}
      <Dialog
        open={Boolean(pendingSlot)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSlot(null);
            setConfirmError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar reserva de turno</DialogTitle>
            <DialogDescription>
              Revisá los datos antes de confirmar tu reserva.
            </DialogDescription>
          </DialogHeader>

          {pendingSlot && (
            <div className="flex flex-col gap-4 py-2">
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 text-body-sm">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">
                    Prestación
                  </span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <Stethoscope className="size-4 text-primary" />
                    {pendingSlot.service.name} (
                    {pendingSlot.service.durationMinutes} min)
                  </p>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground uppercase">
                    Profesional
                  </span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <UserRound className="size-4 text-primary" />
                    Dr/Dra. {pendingSlot.professional.lastName},{" "}
                    {pendingSlot.professional.firstName}{" "}
                    {pendingSlot.professional.licenseNumber && (
                      <span className="text-xs text-muted-foreground font-normal">
                        (Mat. {pendingSlot.professional.licenseNumber})
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground uppercase">
                    Fecha y horario
                  </span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <CalendarClock className="size-4 text-primary" />
                    {formatDate(pendingSlot.date)} · {pendingSlot.startTime} a{" "}
                    {pendingSlot.endTime} hs
                  </p>
                </div>

                <div className="border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground uppercase">
                    Condición de atención
                  </span>
                  {options.patient.coverageType === "PRIVATE" ? (
                    <div className="mt-1">
                      <p className="font-semibold text-foreground flex items-center justify-between">
                        <span>Particular:</span>
                        <span className="font-mono text-base font-bold text-primary tabular-nums">
                          {pendingSlot.service.price !== null
                            ? `$ ${pendingSlot.service.price.toLocaleString(
                                "es-AR",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                },
                              )}`
                            : "A consultar"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        El monto se abona en la recepción del centro al
                        presentarte.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <Badge variant="outline" className="text-xs font-medium">
                        Cobertura por Obra Social
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Servicio sin orden médica ni cobro de coseguro.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {confirmError && (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo confirmar el turno</AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    {confirmError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isConfirming}
              onClick={() => {
                setPendingSlot(null);
                setConfirmError(null);
              }}
            >
              Volver a elegir
            </Button>
            <Button
              type="button"
              disabled={isConfirming}
              onClick={handleConfirmBooking}
              className="gap-2"
            >
              {isConfirming && <Loader2 className="size-4 animate-spin" />}
              {isConfirming ? "Confirmando..." : "Confirmar turno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
