import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  Clock,
  FileText,
  PhoneCall,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/dal/auth";
import { listMyAppointments } from "@/lib/dal/appointments";
import {
  APPOINTMENT_STATUS_BADGE_CLASS,
  APPOINTMENT_STATUS_BORDER_CLASS,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointment-status";
import { DOCUMENT_TYPE_LABEL } from "@/lib/patients";
import { MAX_PORTAL_FUTURE_APPOINTMENTS } from "@/lib/portal";
import { formatDate, formatMinute, toLocalSlot } from "@/lib/schedule";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { CancelMyAppointmentDialog } from "./cancel-my-appointment-dialog";

export const metadata: Metadata = {
  title: "Mis turnos · Portal del Paciente · GOAT",
};

export default async function PortalHomePage() {
  const actor = await requirePageRole(Role.PATIENT);
  if (actor.mustChangePassword) {
    redirect("/portal/change-password");
  }

  const { patient, upcoming, past } = await listMyAppointments(actor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-display-lg font-bold tracking-tight text-foreground">
            Mis turnos
          </h1>
          <p className="text-body-md text-muted-foreground">
            {patient.lastName}, {patient.firstName} ·{" "}
            <span className="font-mono font-medium text-foreground">
              {DOCUMENT_TYPE_LABEL[patient.documentType]}{" "}
              {patient.documentNumber}
            </span>
          </p>
        </div>

        {upcoming.length < MAX_PORTAL_FUTURE_APPOINTMENTS ? (
          <Button asChild className="gap-1.5 shadow-xs">
            <Link href="/portal/appointments/new">
              <CalendarPlus className="size-4" />
              Sacar turno
            </Link>
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-warning-soft-border bg-warning-soft px-3 py-2 text-xs font-medium text-warning-soft-foreground">
            <span>
              Tenés {MAX_PORTAL_FUTURE_APPOINTMENTS} turnos futuros (límite del
              portal alcanzado)
            </span>
          </div>
        )}
      </div>

      {/* Próximos turnos */}
      <Card className="rounded-xl border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
            <CalendarClock className="size-4 text-primary" />
            Próximos turnos ({upcoming.length})
          </CardTitle>
          <CardDescription>
            Turnos programados a futuro, del más cercano al más lejano. Podés
            cancelar sin cargo desde acá hasta 24 horas antes del turno.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          {upcoming.length === 0 ? (
            <Empty className="border bg-muted/20 py-8">
              <EmptyHeader>
                <EmptyTitle>No tenés próximos turnos programados</EmptyTitle>
                <EmptyDescription>
                  Podés solicitar un turno online eligiendo el servicio y el
                  horario que mejor te quede.
                </EmptyDescription>
              </EmptyHeader>
              <div className="mt-4 flex justify-center">
                <Button asChild size="sm" className="gap-1.5">
                  <Link href="/portal/appointments/new">
                    <CalendarPlus className="size-4" />
                    Sacar un turno
                  </Link>
                </Button>
              </div>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map((appt) => {
                const startSlot = toLocalSlot(appt.startsAt);
                const endSlot = toLocalSlot(appt.endsAt);
                const dateLabel = formatDate(startSlot.date);
                const timeRangeLabel = `${formatMinute(startSlot.minute)}–${formatMinute(endSlot.minute)}`;
                const professionalName = `${appt.professional.lastName}, ${appt.professional.firstName}`;

                return (
                  <li
                    key={appt.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border border-l-4 bg-card p-4 transition-colors",
                      APPOINTMENT_STATUS_BORDER_CLASS[appt.status],
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-title-md font-semibold tabular-nums text-foreground">
                            {dateLabel} · {timeRangeLabel} hs
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-lg text-xs font-medium",
                              APPOINTMENT_STATUS_BADGE_CLASS[appt.status],
                            )}
                          >
                            {APPOINTMENT_STATUS_LABEL[appt.status]}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            <Stethoscope className="size-3.5 text-primary" />
                            {appt.service.name}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="size-3.5" />
                            {appt.service.durationMinutes} min
                          </span>
                          <span className="flex items-center gap-1.5">
                            <UserRound className="size-3.5" />
                            {professionalName} (Mat.{" "}
                            {appt.professional.licenseNumber})
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {appt.paidPayment && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                          >
                            <Link
                              href={`/portal/payments/${appt.paidPayment.id}/receipt`}
                            >
                              <FileText className="size-4" />
                              Comprobante de pago
                            </Link>
                          </Button>
                        )}

                        {appt.canCancel && (
                          <CancelMyAppointmentDialog
                            appointmentId={appt.id}
                            dateLabel={dateLabel}
                            timeLabel={formatMinute(startSlot.minute)}
                            professionalName={professionalName}
                            serviceName={appt.service.name}
                          />
                        )}
                      </div>
                    </div>

                    {!appt.withinNoticeWindow && (
                      <div className="flex items-center gap-2 rounded-lg border border-warning-soft-border bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
                        <PhoneCall className="size-3.5 shrink-0" />
                        <span>
                          Faltan menos de 24 horas para el inicio del turno.
                          Para cancelarlo o reprogramarlo, comunicate con el
                          centro.
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Otros turnos */}
      <Card className="rounded-xl border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
            <CalendarCheck2 className="size-4 text-primary" />
            Otros turnos ({past.length})
          </CardTitle>
          <CardDescription>
            Historial de turnos pasados, completados o cancelados, del más
            reciente al más antiguo.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          {past.length === 0 ? (
            <Empty className="border bg-muted/20 py-8">
              <EmptyHeader>
                <EmptyTitle>Sin otros turnos</EmptyTitle>
                <EmptyDescription>
                  Todavía no registrás atenciones o turnos pasados ni cancelados
                  en el centro.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {past.map((appt) => {
                const startSlot = toLocalSlot(appt.startsAt);
                const endSlot = toLocalSlot(appt.endsAt);
                const dateLabel = formatDate(startSlot.date);
                const timeRangeLabel = `${formatMinute(startSlot.minute)}–${formatMinute(endSlot.minute)}`;
                const professionalName = `${appt.professional.lastName}, ${appt.professional.firstName}`;

                return (
                  <li
                    key={appt.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 bg-card px-4 py-3",
                      APPOINTMENT_STATUS_BORDER_CLASS[appt.status],
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body-md font-semibold tabular-nums text-foreground">
                          {dateLabel} · {timeRangeLabel} hs
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-lg text-xs font-medium",
                            APPOINTMENT_STATUS_BADGE_CLASS[appt.status],
                          )}
                        >
                          {APPOINTMENT_STATUS_LABEL[appt.status]}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {appt.service.name}
                        </span>
                        <span>
                          {professionalName} (Mat.{" "}
                          {appt.professional.licenseNumber})
                        </span>
                      </div>
                    </div>

                    {appt.paidPayment && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                      >
                        <Link
                          href={`/portal/payments/${appt.paidPayment.id}/receipt`}
                        >
                          <FileText className="size-4" />
                          Comprobante de pago
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
