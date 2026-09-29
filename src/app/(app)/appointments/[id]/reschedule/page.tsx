import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/dal/auth";
import {
  getAppointment,
  listAvailableDates,
  listAvailableSlots,
} from "@/lib/dal/appointments";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { isCalendarDate, toLocalSlot } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RescheduleForm } from "./reschedule-form";
import type { AvailableSlot } from "@/lib/appointment-slots";

export const metadata = { title: "Reprogramar turno · Goat" };

function positiveId(value: string | string[] | undefined) {
  const id = typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export default async function ReschedulePage({
  params,
  searchParams,
}: PageProps<"/appointments/[id]/reschedule">) {
  const actor = await requirePageRole("RECEPTIONIST", "MANAGER");
  const { id } = await params;
  const appointmentId = Number(id);

  if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
    notFound();
  }

  let appointment;
  try {
    appointment = await getAppointment(appointmentId, actor);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const query = await searchParams;
  const now = new Date();
  const isScheduled = appointment.status === "SCHEDULED";
  const isFuture = appointment.startsAt > now;

  if (!isScheduled || !isFuture) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-headline-lg">
          Reprogramar turno #{appointment.id}
        </h1>
        <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border">
          <AlertTitle>No es posible reprogramar este turno</AlertTitle>
          <AlertDescription className="text-destructive-soft-foreground">
            {!isScheduled
              ? "Solo se pueden reprogramar turnos en estado Programado."
              : "Solo se pueden reprogramar turnos programados que aún no hayan comenzado."}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="self-start">
          <Link href={`/appointments/${appointment.id}`}>
            Volver al detalle del turno
          </Link>
        </Button>
      </div>
    );
  }

  // Profesionales activos que prestan este servicio y tienen franjas de atención
  const professionals = await prisma.professional.findMany({
    where: {
      active: true,
      services: { some: { id: appointment.service.id, active: true } },
      availabilityWindows: {
        some: {
          OR: [
            { services: { none: {} } },
            { services: { some: { id: appointment.service.id } } },
          ],
        },
      },
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const queryProfessionalId = positiveId(query.professionalId);
  const selectedProfessionalId =
    queryProfessionalId &&
    professionals.some((p) => p.id === queryProfessionalId)
      ? queryProfessionalId
      : appointment.professional.id;

  const requestedDate =
    typeof query.date === "string" && isCalendarDate(query.date)
      ? query.date
      : undefined;

  let availableDates: string[] = [];
  let slots: AvailableSlot[] = [];
  let availabilityError = "";
  let selectedDate = requestedDate ?? "";

  try {
    availableDates = await listAvailableDates(
      {
        patientId: appointment.patient.id,
        serviceId: appointment.service.id,
        professionalId: selectedProfessionalId,
        excludeAppointmentId: appointment.id,
      },
      actor,
    );

    const currentSlotDate = toLocalSlot(appointment.startsAt).date;
    if (
      requestedDate === undefined &&
      selectedProfessionalId === appointment.professional.id &&
      availableDates.includes(currentSlotDate)
    ) {
      selectedDate = currentSlotDate;
    }

    if (selectedDate) {
      slots = await listAvailableSlots(
        {
          patientId: appointment.patient.id,
          serviceId: appointment.service.id,
          professionalId: selectedProfessionalId,
          date: selectedDate,
          excludeAppointmentId: appointment.id,
        },
        actor,
      );
    }
  } catch (error) {
    if (error instanceof DomainError) {
      availabilityError = error.message;
    } else {
      throw error;
    }
  }

  const dateIndex = selectedDate ? availableDates.indexOf(selectedDate) : -1;
  const initialPage = dateIndex >= 0 ? Math.floor(dateIndex / 14) + 1 : 1;
  const datePage = Math.min(positiveId(query.datePage) ?? initialPage, 10);
  const visibleDatePage = Math.min(
    datePage,
    Math.max(1, Math.ceil(availableDates.length / 14)),
  );
  const visibleDates = availableDates.slice(
    (visibleDatePage - 1) * 14,
    visibleDatePage * 14,
  );

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-headline-lg">
          Reprogramar turno #{appointment.id}
        </h1>
        <p className="text-muted-foreground">
          Elegí un nuevo día, horario u otro profesional para el mismo servicio.
          El horario actual quedará liberado de inmediato.
        </p>
      </header>

      <RescheduleForm
        key={appointment.id}
        appointmentId={appointment.id}
        patient={appointment.patient}
        service={appointment.service}
        currentProfessional={appointment.professional}
        currentStartsAt={appointment.startsAt.toISOString()}
        currentEndsAt={appointment.endsAt.toISOString()}
        professionals={professionals}
        selectedProfessionalId={selectedProfessionalId}
        availableDates={availableDates}
        visibleDates={visibleDates}
        visibleDatePage={visibleDatePage}
        selectedDate={selectedDate}
        slots={slots}
        availabilityError={availabilityError}
      />
    </>
  );
}
