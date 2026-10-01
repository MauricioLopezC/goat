import Link from "next/link";
import { patientHistoryHref } from "@/lib/patient-history";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/dal/auth";
import { getAppointment } from "@/lib/dal/appointments";
import { getAppointmentBilling } from "@/lib/dal/payments";
import { listActivePaymentMethods } from "@/lib/dal/payment-methods";
import {
  PAYMENT_STATE_BADGE_CLASS,
  PAYMENT_STATE_LABEL,
  formatAmount,
} from "@/lib/payments";
import { DomainError } from "@/lib/actions";
import {
  formatDate,
  formatMinute,
  formatInstant,
  toLocalSlot,
} from "@/lib/schedule";
import {
  APPOINTMENT_EVENT_LABEL,
  APPOINTMENT_STATUS_BADGE_CLASS,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointment-status";
import {
  calendarHref,
  calendarSearch,
  parseCalendarQuery,
} from "@/lib/calendar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancelAppointmentDialog } from "./cancel-dialog";
import { StatusChangeDialog, type StatusChangeTarget } from "./status-dialog";
import { PaymentDialog } from "./payment-dialog";
import { VoidPaymentDialog } from "./void-payment-dialog";
import { AuthorizationDialog } from "./authorization-dialog";

export default async function AppointmentPage({
  params,
  searchParams,
}: PageProps<"/appointments/[id]">) {
  const actor = await requirePageRole(
    "RECEPTIONIST",
    "MANAGER",
    "PROFESSIONAL",
  );
  const { id } = await params;
  const query = await searchParams;
  const {
    created,
    cancelled,
    changed,
    rescheduled,
    billing: billingNotice,
  } = query;
  let appointment;
  try {
    appointment = await getAppointment(Number(id), actor);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const start = toLocalSlot(appointment.startsAt);
  const end = toLocalSlot(appointment.endsAt);
  const own = actor.role === "PROFESSIONAL";
  // El profesional no ve cobros ni autorizaciones (HU-21).
  const billing = own
    ? null
    : await getAppointmentBilling(appointment.id, actor);
  const canCharge =
    billing?.chargeable === true &&
    billing.state === "PENDING_PAYMENT" &&
    billing.price !== null;
  const canAuthorize =
    billing?.chargeable === true &&
    (billing.state === "PENDING_AUTHORIZATION" ||
      billing.state === "AUTHORIZED");
  const paymentMethods = canCharge ? await listActivePaymentMethods(actor) : [];
  // Con cobro vigente no se cancela ni se vence: primero se anula (HU-21).
  const paid = billing?.activePayment !== undefined;
  const scheduled = appointment.status === "SCHEDULED";
  const now = new Date();
  const canReschedule = scheduled && appointment.startsAt > now;
  const canComplete = scheduled && appointment.startsAt <= now;
  const canExpire = scheduled && !paid && appointment.endsAt <= now;
  const canCancel = scheduled && !paid;

  const summary = `${appointment.patient.lastName}, ${appointment.patient.firstName} · ${appointment.professional.lastName}, ${appointment.professional.firstName} · ${appointment.service.name} · ${formatDate(start.date)}, ${formatMinute(start.minute)}–${formatMinute(end.minute)}`;
  // Se vuelve al mismo calendario (vista, fecha y filtros) desde el que se
  // abrió el turno; sin parámetros, al día del turno.
  const calendarQuery = parseCalendarQuery(query, start.date);
  const returnSearch = calendarSearch(calendarQuery);
  const billingHref = (notice: "paid" | "authorized") => {
    const search = new URLSearchParams(returnSearch);
    search.set("billing", notice);
    return `/appointments/${appointment.id}?${search}`;
  };
  const changedHref = (target: StatusChangeTarget) => {
    const search = new URLSearchParams(returnSearch);
    search.set("changed", target);
    return `/appointments/${appointment.id}?${search}`;
  };

  return (
    <>
      <h1 className="text-headline-lg">Turno #{appointment.id}</h1>
      {created === "1" && !own && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>Turno registrado correctamente</AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            El horario quedó reservado y ya aparece en el calendario y en la
            agenda del profesional.
          </AlertDescription>
        </Alert>
      )}
      {rescheduled === "1" && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>Turno reprogramado exitosamente</AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            El nuevo horario es el {formatDate(start.date)}, de{" "}
            {formatMinute(start.minute)} a {formatMinute(end.minute)} con{" "}
            {appointment.professional.lastName},{" "}
            {appointment.professional.firstName}.
          </AlertDescription>
        </Alert>
      )}
      {cancelled === "1" && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>Turno cancelado exitosamente</AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            El turno #{appointment.id} fue cancelado y el horario quedó liberado
            de inmediato.
          </AlertDescription>
        </Alert>
      )}
      {appointment.status === "CANCELLED" && cancelled !== "1" && (
        <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border">
          <AlertTitle>Turno cancelado</AlertTitle>
          <AlertDescription className="text-destructive-soft-foreground">
            Este turno fue cancelado. El horario quedó disponible.
          </AlertDescription>
        </Alert>
      )}
      {(changed === "COMPLETED" || changed === "EXPIRED") && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>
            Turno marcado como {APPOINTMENT_STATUS_LABEL[changed].toLowerCase()}
          </AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            El cambio quedó registrado en el historial del turno.
          </AlertDescription>
        </Alert>
      )}
      {billingNotice === "paid" && billing?.activePayment && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>
            Cobro registrado: {formatAmount(billing.activePayment.amount)}
          </AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            Se cobró con {billing.activePayment.paymentMethod}.
          </AlertDescription>
        </Alert>
      )}
      {billingNotice === "voided" && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>Cobro anulado</AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            El cobro quedó registrado como anulado y el turno se puede volver a
            cobrar.
          </AlertDescription>
        </Alert>
      )}
      {billingNotice === "authorized" && billing?.authorization && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>Autorización registrada</AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            Número de autorización: {billing.authorization.number}.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <Badge
              variant="outline"
              className={APPOINTMENT_STATUS_BADGE_CLASS[appointment.status]}
            >
              {APPOINTMENT_STATUS_LABEL[appointment.status]}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Paciente</dt>
              <dd>
                {appointment.patient.lastName}, {appointment.patient.firstName}{" "}
                · {appointment.patient.documentType}{" "}
                {appointment.patient.documentNumber}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Servicio</dt>
              <dd>{appointment.service.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Profesional</dt>
              <dd>
                {appointment.professional.lastName},{" "}
                {appointment.professional.firstName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Día</dt>
              <dd>{formatDate(start.date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Horario (Argentina)</dt>
              <dd className="tabular-nums">
                {formatMinute(start.minute)}–{formatMinute(end.minute)}
                {end.date !== start.date ? " del día siguiente" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Duración</dt>
              <dd>
                {(appointment.endsAt.getTime() -
                  appointment.startsAt.getTime()) /
                  60_000}{" "}
                minutos
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Registrado por</dt>
              <dd>
                {appointment.createdBy.lastName},{" "}
                {appointment.createdBy.firstName} ·{" "}
                {formatInstant(appointment.createdAt)}
              </dd>
            </div>
            {appointment.notes && (
              <div>
                <dt className="text-muted-foreground">Observación</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {appointment.notes}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
      {billing?.state && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {billing.state === "PENDING_PAYMENT" || billing.state === "PAID"
                ? "Cobro"
                : "Autorización de la obra social"}
              <Badge
                variant="outline"
                className={PAYMENT_STATE_BADGE_CLASS[billing.state]}
              >
                {PAYMENT_STATE_LABEL[billing.state]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {billing.activePayment && (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Monto</dt>
                  <dd className="tabular-nums">
                    {formatAmount(billing.activePayment.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Medio de pago</dt>
                  <dd>{billing.activePayment.paymentMethod}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cobrado por</dt>
                  <dd>
                    {billing.activePayment.createdBy.lastName},{" "}
                    {billing.activePayment.createdBy.firstName} ·{" "}
                    {formatInstant(billing.activePayment.createdAt)}
                  </dd>
                </div>
              </dl>
            )}
            {billing.authorization && (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">
                    Número de autorización
                  </dt>
                  <dd className="break-words">
                    {billing.authorization.number}
                  </dd>
                </div>
                {billing.authorization.by && billing.authorization.at && (
                  <div>
                    <dt className="text-muted-foreground">Registrada por</dt>
                    <dd>
                      {billing.authorization.by.lastName},{" "}
                      {billing.authorization.by.firstName} ·{" "}
                      {formatInstant(billing.authorization.at)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {billing.state === "PENDING_PAYMENT" &&
              (billing.price === null ? (
                <Alert className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border">
                  <AlertTitle>El servicio no tiene valor cargado</AlertTitle>
                  <AlertDescription className="text-warning-soft-foreground">
                    No se puede cobrar hasta que el gerente cargue el valor de{" "}
                    {appointment.service.name} en Servicios.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground">
                  Valor del servicio:{" "}
                  <span className="text-foreground tabular-nums">
                    {formatAmount(billing.price)}
                  </span>
                  {!billing.chargeable &&
                    ". Se cobra el día del turno o cuando esté completado."}
                </p>
              ))}
            {billing.state === "PENDING_AUTHORIZATION" &&
              !billing.chargeable && (
                <p className="text-muted-foreground">
                  El servicio requiere orden médica. La autorización se registra
                  el día del turno, cuando llega el paciente.
                </p>
              )}
            {(canCharge || paid || canAuthorize) && (
              <div className="flex flex-wrap gap-3">
                {canCharge && billing.price !== null && (
                  <PaymentDialog
                    appointmentId={appointment.id}
                    successHref={billingHref("paid")}
                    summary={summary}
                    price={billing.price}
                    paymentMethods={paymentMethods}
                  />
                )}
                {billing.activePayment && (
                  <VoidPaymentDialog
                    paymentId={billing.activePayment.id}
                    appointmentId={appointment.id}
                    returnSearch={returnSearch}
                    description={`${formatAmount(billing.activePayment.amount)} con ${billing.activePayment.paymentMethod}`}
                  />
                )}
                {canAuthorize && (
                  <AuthorizationDialog
                    appointmentId={appointment.id}
                    successHref={billingHref("authorized")}
                    summary={summary}
                    currentNumber={billing.authorization?.number ?? null}
                  />
                )}
              </div>
            )}
            {billing.voidedPayments.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">Cobros anulados</p>
                <ul className="flex flex-col gap-3">
                  {billing.voidedPayments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex flex-col gap-0.5 text-sm"
                    >
                      <p className="tabular-nums">
                        {formatAmount(payment.amount)} · {payment.paymentMethod}{" "}
                        · cobrado por {payment.createdBy.lastName},{" "}
                        {payment.createdBy.firstName} ·{" "}
                        {formatInstant(payment.createdAt)}
                      </p>
                      {payment.voidedBy && payment.voidedAt && (
                        <p className="text-muted-foreground">
                          Anulado por {payment.voidedBy.lastName},{" "}
                          {payment.voidedBy.firstName} ·{" "}
                          {formatInstant(payment.voidedAt)}
                        </p>
                      )}
                      {payment.voidReason && (
                        <p className="text-muted-foreground">
                          Motivo: {payment.voidReason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {appointment.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {appointment.events.map((event) => (
                <li key={event.id} className="flex flex-col gap-0.5 text-sm">
                  <p className="font-medium">
                    {APPOINTMENT_EVENT_LABEL[event.type]} ·{" "}
                    {formatInstant(event.createdAt)}
                  </p>
                  <p className="text-muted-foreground">
                    Por: {event.user.lastName}, {event.user.firstName}
                  </p>
                  {event.type === "RESCHEDULED" &&
                    event.previousStartsAt &&
                    event.newStartsAt && (
                      <div className="text-muted-foreground flex flex-col gap-0.5">
                        <p>
                          Horario anterior:{" "}
                          {formatDate(toLocalSlot(event.previousStartsAt).date)}
                          ,{" "}
                          {formatMinute(
                            toLocalSlot(event.previousStartsAt).minute,
                          )}
                          –
                          {formatMinute(
                            toLocalSlot(event.previousEndsAt!).minute,
                          )}
                          {event.previousProfessional &&
                            ` · ${event.previousProfessional.lastName}, ${event.previousProfessional.firstName}`}
                        </p>
                        <p>
                          Nuevo horario:{" "}
                          {formatDate(toLocalSlot(event.newStartsAt).date)},{" "}
                          {formatMinute(toLocalSlot(event.newStartsAt).minute)}–
                          {formatMinute(toLocalSlot(event.newEndsAt!).minute)}
                          {event.newProfessional &&
                            ` · ${event.newProfessional.lastName}, ${event.newProfessional.firstName}`}
                        </p>
                      </div>
                    )}
                  {event.reason && (
                    <p className="text-muted-foreground">
                      Motivo: {event.reason}
                    </p>
                  )}
                  {event.requestedBy && (
                    <p className="text-muted-foreground">
                      Solicitó: {event.requestedBy}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Alert>
        <AlertTitle>Email al paciente: PENDIENTE</AlertTitle>
        <AlertDescription>
          El envío de avisos por correo todavía no está implementado. No se
          envió un email al registrar este turno.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link
            href={
              own ? `/agenda?date=${start.date}` : calendarHref(calendarQuery)
            }
          >
            {own ? "Volver a mi agenda" : "Volver al calendario"}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={patientHistoryHref(appointment.patient.id)}>
            Historial del paciente
          </Link>
        </Button>
        {!own && (
          <Button asChild>
            <Link href="/appointments/new">Dar otro turno</Link>
          </Button>
        )}
        {canReschedule && (
          <Button asChild variant="outline">
            <Link
              href={`/appointments/${appointment.id}/reschedule${returnSearch ? `?${returnSearch}` : ""}`}
            >
              Reprogramar turno
            </Link>
          </Button>
        )}
        {canComplete && (
          <StatusChangeDialog
            appointmentId={appointment.id}
            target="COMPLETED"
            summary={summary}
            successHref={changedHref("COMPLETED")}
          />
        )}
        {canExpire && (
          <StatusChangeDialog
            appointmentId={appointment.id}
            target="EXPIRED"
            summary={summary}
            successHref={changedHref("EXPIRED")}
          />
        )}
        {canCancel && (
          <CancelAppointmentDialog
            appointmentId={appointment.id}
            summary={summary}
            returnSearch={returnSearch}
          />
        )}
      </div>
      {!own && scheduled && paid && (
        <p className="text-muted-foreground">
          El turno tiene un cobro registrado. Para cancelarlo o marcarlo como
          vencido, primero anulá el cobro.
        </p>
      )}
      {scheduled && !paid && !canExpire && (
        <p className="text-muted-foreground">
          {canComplete
            ? "Podrás marcarlo como vencido cuando termine su horario."
            : "Podrás marcarlo como completado cuando comience y como vencido cuando termine."}
        </p>
      )}
    </>
  );
}
