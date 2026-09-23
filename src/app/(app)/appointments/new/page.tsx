import Link from "next/link";
import { requirePageRole } from "@/lib/dal/auth";
import {
  getAppointmentOptions,
  listAvailableSlots,
} from "@/lib/dal/appointments";
import { DomainError } from "@/lib/actions";
import {
  appointmentDateBounds,
  type AvailableSlot,
} from "@/lib/appointment-slots";
import { isCalendarDate } from "@/lib/schedule";
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
import { AppointmentDateField } from "./appointment-date-field";
import { PatientSearch } from "./patient-search";

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
  const patientId = positiveId(params.patientId);
  const serviceId = positiveId(params.serviceId);
  const professionalId = positiveId(params.professionalId);
  const bounds = appointmentDateBounds();
  const date = typeof params.date === "string" ? params.date : bounds.min;
  const options = await getAppointmentOptions(
    { query, patientId, serviceId },
    actor,
  );
  const service = options.services.find((item) => item.id === serviceId);
  const professional = options.professionals.find(
    (item) => item.id === professionalId,
  );
  const patient = options.patient;
  let slots: AvailableSlot[] = [];
  let availabilityError = "";
  if (patient && service && professional) {
    try {
      slots = await listAvailableSlots(
        {
          patientId: patient.id,
          serviceId: service.id,
          professionalId: professional.id,
          date,
        },
        actor,
      );
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      availabilityError = error.message;
    }
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
                <Link href="/appointments/new">Cambiar paciente</Link>
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
              <PatientSearch initialQuery={query} />
              {query && (
                <p className="text-muted-foreground">
                  {options.patients.length
                    ? "Elegí un paciente. Se muestran hasta 30 resultados; afiná la búsqueda si hace falta."
                    : "No se encontraron pacientes activos."}
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {options.patients.map((item) => (
                  <li key={item.id}>
                    <Button
                      asChild
                      variant="outline"
                      className="h-auto min-h-9.5 whitespace-normal text-left"
                    >
                      <Link href={`/appointments/new?patientId=${item.id}`}>
                        {item.lastName}, {item.firstName} · {item.documentType}{" "}
                        {item.documentNumber}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
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
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/appointments/new" className="flex flex-col gap-3">
              <input type="hidden" name="patientId" value={patient.id} />
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
                    {options.services.map((item) => (
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
              <form action="/appointments/new" className="flex flex-col gap-3">
                <input type="hidden" name="patientId" value={patient.id} />
                <input type="hidden" name="serviceId" value={service.id} />
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="professional">Profesional</FieldLabel>
                    <NativeSelect
                      id="professional"
                      name="professionalId"
                      defaultValue={professional?.id ?? ""}
                      required
                      className="w-full"
                    >
                      <NativeSelectOption value="">
                        Elegí un profesional
                      </NativeSelectOption>
                      {options.professionals.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.lastName}, {item.firstName}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <AppointmentDateField
                    date={isCalendarDate(date) ? date : bounds.min}
                    min={bounds.min}
                    max={bounds.max}
                  />
                </FieldGroup>
                <Button type="submit" className="self-start">
                  Ver horarios disponibles
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
      {availabilityError && (
        <Alert variant="destructive">
          <AlertDescription>{availabilityError}</AlertDescription>
        </Alert>
      )}
      {patient && service && professional && !availabilityError && (
        <Card>
          <CardHeader>
            <CardTitle>Horario y confirmación</CardTitle>
          </CardHeader>
          <CardContent>
            <AppointmentForm
              key={`${patient.id}-${service.id}-${professional.id}-${date}`}
              input={{
                patientId: patient.id,
                serviceId: service.id,
                professionalId: professional.id,
                date,
              }}
              slots={slots}
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
