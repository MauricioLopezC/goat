import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { requirePageRole } from "@/lib/dal/auth";
import {
  getAppointmentOptions,
  listAvailableDates,
  listAvailableSlots,
} from "@/lib/dal/appointments";
import { listProfessionals } from "@/lib/dal/professionals";
import { DomainError } from "@/lib/actions";
import { type AvailableSlot } from "@/lib/appointment-slots";
import {
  dateToDb,
  formatDate,
  isCalendarDate,
  TIME_PATTERN,
} from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppointmentForm } from "./appointment-form";
import { PatientSearch } from "./patient-search";
import { ProfessionalPicker } from "./professional-picker";

export const metadata = { title: "Nuevo turno · Goat" };
function positiveId(value: string | string[] | undefined) {
  const id = typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
export default async function NewAppointmentPage({
  searchParams,
}: PageProps<"/appointments/new">) {
  const actor = await requirePageRole("RECEPTIONIST", "MANAGER");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const patientPage = Math.min(positiveId(params.patientPage) ?? 1, 1000);
  const datePage = Math.min(positiveId(params.datePage) ?? 1, 10);
  const patientId = positiveId(params.patientId);
  const serviceId = positiveId(params.serviceId);
  const professionalId = positiveId(params.professionalId);
  const date = typeof params.date === "string" ? params.date : "";
  const startTime =
    typeof params.startTime === "string" && TIME_PATTERN.test(params.startTime)
      ? params.startTime
      : "";
  // Desde un bloque libre del calendario (HU-11) llegan profesional, fecha y
  // hora, y el servicio si estaba filtrado. Se conservan mientras se elige
  // paciente y servicio.
  const preset = new URLSearchParams();
  if (serviceId) preset.set("serviceId", String(serviceId));
  if (professionalId) preset.set("professionalId", String(professionalId));
  if (date && isCalendarDate(date)) preset.set("date", date);
  if (startTime) preset.set("startTime", startTime);
  function withPreset(values: Record<string, string>) {
    const search = new URLSearchParams(preset);
    for (const [key, value] of Object.entries(values)) search.set(key, value);
    return `/appointments/new?${search}`;
  }
  const options = await getAppointmentOptions(
    { query, patientPage, patientId, serviceId },
    actor,
  );
  // El profesional del bloque libre elegido en el calendario: se ofrecen solo
  // los servicios que presta, para no perder la precarga al elegir otro.
  const presetProfessional =
    professionalId && preset.has("date") && startTime
      ? (await listProfessionals({ status: "active" }, actor)).find(
          (item) => item.id === professionalId,
        )
      : undefined;
  const serviceOptions = presetProfessional
    ? options.services.filter((item) =>
        presetProfessional.services.some((offered) => offered.id === item.id),
      )
    : options.services;
  const service = serviceOptions.find((item) => item.id === serviceId);
  const professional = options.professionals.find(
    (item) => item.id === professionalId,
  );
  const patient = options.patient;
  let slots: AvailableSlot[] = [];
  let availableDates: string[] = [];
  let availabilityError = "";
  if (patient && service && professional) {
    try {
      availableDates = await listAvailableDates(
        {
          patientId: patient.id,
          serviceId: service.id,
          professionalId: professional.id,
        },
        actor,
      );
      if (date && isCalendarDate(date)) {
        slots = await listAvailableSlots(
          {
            patientId: patient.id,
            serviceId: service.id,
            professionalId: professional.id,
            date,
          },
          actor,
        );
      }
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      availabilityError = error.message;
    }
  }
  const visibleDatePage = Math.min(
    datePage,
    Math.max(1, Math.ceil(availableDates.length / 14)),
  );
  const visibleDates = availableDates.slice(
    (visibleDatePage - 1) * 14,
    visibleDatePage * 14,
  );
  function datesHref(page: number, chosenDate?: string) {
    const search = new URLSearchParams({
      patientId: String(patient?.id),
      serviceId: String(service?.id),
      professionalId: String(professional?.id),
    });
    if (page > 1) search.set("datePage", String(page));
    if (chosenDate) search.set("date", chosenDate);
    return `/appointments/new?${search}`;
  }
  return (
    <>
      <header>
        <h1 className="text-headline-lg">Nuevo turno</h1>
        <p className="text-muted-foreground">
          Elegí paciente, servicio, profesional y horario. Todos los horarios
          corresponden a Argentina.
        </p>
      </header>
      {presetProfessional && (
        <Alert>
          <AlertDescription>
            Horario elegido en el calendario: {presetProfessional.lastName},{" "}
            {presetProfessional.firstName}, {formatDate(date)}, {startTime}.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>1. Paciente</CardTitle>
          <CardDescription>
            Buscá por nombre, apellido o documento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {patient ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                <strong>
                  {patient.lastName}, {patient.firstName}
                </strong>{" "}
                · {patient.documentType} {patient.documentNumber}
              </p>
              <Button asChild variant="outline">
                <Link href={withPreset({})}>Cambiar paciente</Link>
              </Button>
            </div>
          ) : (
            <>
              {patientId && (
                <Alert>
                  <AlertDescription>
                    El paciente elegido no está disponible. Buscá otro paciente
                    activo.
                  </AlertDescription>
                </Alert>
              )}
              <PatientSearch initialQuery={query} preset={preset.toString()} />
              <p className="text-muted-foreground">
                {options.patients.length
                  ? query
                    ? "Resultados de búsqueda"
                    : "Pacientes registrados recientemente"
                  : query
                    ? "No se encontraron pacientes activos."
                    : "No hay pacientes activos registrados."}
              </p>
              <ul className="w-full divide-y overflow-hidden rounded-lg border">
                {options.patients.map((item) => (
                  <li key={item.id}>
                    <Button
                      asChild
                      variant="ghost"
                      className="h-auto min-h-14 w-full justify-between gap-4 whitespace-normal text-left"
                    >
                      <Link href={withPreset({ patientId: String(item.id) })}>
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-medium">
                            {item.lastName}, {item.firstName}
                          </span>
                          <span className="text-muted-foreground text-code-sm tabular-nums">
                            {item.documentType} {item.documentNumber}
                          </span>
                        </span>
                        <ChevronRightIcon
                          data-icon="inline-end"
                          aria-hidden="true"
                        />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
              {(patientPage > 1 || options.hasMorePatients) && (
                <nav
                  aria-label="Páginas de pacientes"
                  className="flex flex-wrap items-center justify-end gap-3"
                >
                  {patientPage > 1 && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={withPreset({
                          ...(query ? { q: query } : {}),
                          patientPage: String(patientPage - 1),
                        })}
                        scroll={false}
                      >
                        ← Página anterior
                      </Link>
                    </Button>
                  )}
                  <span className="text-muted-foreground">
                    Página {patientPage}
                  </span>
                  {options.hasMorePatients && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={withPreset({
                          ...(query ? { q: query } : {}),
                          patientPage: String(patientPage + 1),
                        })}
                        scroll={false}
                      >
                        Página siguiente →
                      </Link>
                    </Button>
                  )}
                </nav>
              )}
              <Button asChild variant="outline" className="self-start">
                <Link href="/patients/new">Registrar un paciente nuevo</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      {patient && (
        <Card>
          <CardHeader>
            <CardTitle>2. Servicio</CardTitle>
            <CardDescription>
              La duración del servicio determina cuánto ocupa el turno.
              {presetProfessional &&
                ` Se muestran los servicios que presta ${presetProfessional.lastName}, ${presetProfessional.firstName}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/appointments/new" className="flex flex-col gap-3">
              <input type="hidden" name="patientId" value={patient.id} />
              {[...preset]
                .filter(([key]) => key !== "serviceId")
                .map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="service">Servicio</FieldLabel>
                  <NativeSelect
                    id="service"
                    name="serviceId"
                    defaultValue={service?.id ?? ""}
                    required
                    className="w-full"
                  >
                    <NativeSelectOption value="">
                      Elegí un servicio
                    </NativeSelectOption>
                    {serviceOptions.map((item) => (
                      <NativeSelectOption value={item.id} key={item.id}>
                        {item.name} · {item.durationMinutes} min
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </FieldGroup>
              <Button type="submit" variant="outline" className="self-start">
                Seleccionar servicio
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {patient && service && (
        <Card>
          <CardHeader>
            <CardTitle>3. Profesional y fecha</CardTitle>
            <CardDescription>
              Solo profesionales activos que prestan {service.name} y tienen
              franjas habilitadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {options.professionals.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No hay profesionales con horarios de atención habilitados para
                  este servicio. El gerente debe cargar las franjas desde
                  Profesionales → Ver ficha → Editar horarios.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-4">
                <ProfessionalPicker
                  patientId={patient.id}
                  serviceId={service.id}
                  professionalId={professional?.id}
                  professionals={options.professionals}
                />
                {professional && !availabilityError && (
                  <div className="flex flex-col gap-3">
                    <p>Elegí una fecha disponible</p>
                    {availableDates.length === 0 ? (
                      <p className="text-muted-foreground">
                        No hay fechas disponibles en los próximos dos meses.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {visibleDates.map((availableDate) => (
                          <Button
                            key={availableDate}
                            asChild
                            variant={
                              availableDate === date ? "default" : "outline"
                            }
                            className="h-auto min-h-9.5 whitespace-normal text-center"
                          >
                            <Link
                              href={datesHref(visibleDatePage, availableDate)}
                              scroll={false}
                              prefetch={false}
                              aria-current={
                                availableDate === date ? "date" : undefined
                              }
                            >
                              {new Intl.DateTimeFormat("es-AR", {
                                weekday: "short",
                                day: "numeric",
                                month: "numeric",
                                year: "numeric",
                                timeZone: "UTC",
                              }).format(dateToDb(availableDate))}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    )}
                    {availableDates.length > 14 && (
                      <nav
                        aria-label="Páginas de fechas disponibles"
                        className="flex items-center gap-3"
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
                        <span className="text-muted-foreground">
                          Página {visibleDatePage}
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
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {availabilityError && (
        <Alert variant="destructive">
          <AlertDescription>{availabilityError}</AlertDescription>
        </Alert>
      )}
      {patient &&
        service &&
        professional &&
        date &&
        isCalendarDate(date) &&
        !availabilityError && (
          <Card>
            <CardHeader>
              <CardTitle>Horario y confirmación</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {startTime &&
                !slots.some((slot) => slot.startTime === startTime) && (
                  <Alert>
                    <AlertDescription>
                      El horario de las {startTime} elegido en el calendario no
                      está disponible para {service.name}. Elegí otro horario.
                    </AlertDescription>
                  </Alert>
                )}
              <AppointmentForm
                key={`${patient.id}-${service.id}-${professional.id}-${date}`}
                input={{
                  patientId: patient.id,
                  serviceId: service.id,
                  professionalId: professional.id,
                  date,
                }}
                slots={slots}
                initialStartTime={startTime}
                patientName={`${patient.lastName}, ${patient.firstName}`}
                professionalName={`${professional.lastName}, ${professional.firstName}`}
                serviceName={service.name}
              />
            </CardContent>
          </Card>
        )}
    </>
  );
}
