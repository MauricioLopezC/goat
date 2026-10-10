import type { Metadata } from "next";
import Link from "next/link";
import { requirePageRole } from "@/lib/dal/auth";
import { listTodayAppointments } from "@/lib/dal/payments";
import { listActivePaymentMethods } from "@/lib/dal/payment-methods";
import {
  PAYMENT_STATE_BADGE_CLASS,
  PAYMENT_STATE_LABEL,
  formatAmount,
} from "@/lib/payments";
import {
  APPOINTMENT_STATUS_BADGE_CLASS,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointment-status";
import { COVERAGE_TYPE_LABEL } from "@/lib/patients";
import { formatDate, formatMinute, toLocalSlot } from "@/lib/schedule";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentDialog } from "../appointments/[id]/payment-dialog";
import { AuthorizationDialog } from "../appointments/[id]/authorization-dialog";

export const metadata: Metadata = { title: "Turnos de hoy · Goat" };

type TodayRow = Awaited<ReturnType<typeof listTodayAppointments>>[number];

function schedule(row: TodayRow) {
  const start = toLocalSlot(row.startsAt);
  const end = toLocalSlot(row.endsAt);
  return `${formatMinute(start.minute)}–${formatMinute(end.minute)}`;
}

// Turnos de hoy (HU-21): la agenda del mostrador. Todos los turnos del día por
// horario; cobrar o registrar la autorización es la acción de la fila cuando
// corresponde.
export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const actor = await requirePageRole("RECEPTIONIST", "MANAGER");
  const { paid, authorized } = await searchParams;
  const rows = await listTodayAppointments(actor);
  const pendingPayment = rows.filter(
    (row) => row.state === "PENDING_PAYMENT",
  ).length;
  const pendingAuthorization = rows.filter(
    (row) => row.state === "PENDING_AUTHORIZATION",
  ).length;
  const paymentMethods = rows.some(
    (row) => row.state === "PENDING_PAYMENT" && row.price !== null,
  )
    ? await listActivePaymentMethods(actor)
    : [];
  const paidRow = rows.find((row) => String(row.id) === paid);
  const authorizedRow = rows.find((row) => String(row.id) === authorized);
  const today = toLocalSlot(new Date()).date;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-display-lg font-semibold tracking-tight text-foreground">
          Turnos de hoy
        </h1>
        <p className="text-body-lg text-muted-foreground mt-1">
          {formatDate(today)} · {rows.length}{" "}
          {rows.length === 1 ? "turno" : "turnos"}
          {pendingPayment > 0 && ` · ${pendingPayment} por cobrar`}
          {pendingAuthorization > 0 &&
            ` · ${pendingAuthorization} por autorizar`}
        </p>
      </div>

      {paidRow?.activePayment && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Cobro registrado: {formatAmount(paidRow.activePayment.amount)}
            </span>
            <Button
              size="sm"
              variant="outline"
              asChild
              className="bg-card text-foreground"
            >
              <Link href={`/payments/${paidRow.activePayment.id}/receipt`}>
                Ver comprobante
              </Link>
            </Button>
          </AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            {paidRow.patient.lastName}, {paidRow.patient.firstName} · se cobró
            con {paidRow.activePayment.paymentMethod}.
          </AlertDescription>
        </Alert>
      )}
      {authorizedRow?.authorizationNumber && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>Autorización registrada</AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            {authorizedRow.patient.lastName}, {authorizedRow.patient.firstName}{" "}
            · número de autorización: {authorizedRow.authorizationNumber}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground">No hay turnos para hoy.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Horario</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profesional · Servicio</TableHead>
                  <TableHead>Cobertura</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Cobro o autorización</TableHead>
                  <TableHead>
                    <span className="sr-only">Acción</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="tabular-nums">{schedule(row)}</p>
                      <Badge
                        variant="outline"
                        className={APPOINTMENT_STATUS_BADGE_CLASS[row.status]}
                      >
                        {APPOINTMENT_STATUS_LABEL[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/appointments/${row.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.patient.lastName}, {row.patient.firstName}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {row.patient.documentType} {row.patient.documentNumber}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>
                        {row.professional.lastName},{" "}
                        {row.professional.firstName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {row.service.name}
                      </p>
                    </TableCell>
                    <TableCell>
                      {COVERAGE_TYPE_LABEL[row.patient.coverageType]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.activePayment ? (
                        formatAmount(row.activePayment.amount)
                      ) : row.state === "PENDING_PAYMENT" &&
                        row.price !== null ? (
                        formatAmount(row.price)
                      ) : row.state === "PENDING_PAYMENT" ? (
                        <span className="text-muted-foreground">Sin valor</span>
                      ) : (
                        <span className="text-muted-foreground">
                          No se cobra
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.state ? (
                        <>
                          <Badge
                            variant="outline"
                            className={PAYMENT_STATE_BADGE_CLASS[row.state]}
                          >
                            {PAYMENT_STATE_LABEL[row.state]}
                          </Badge>
                          {row.activePayment && (
                            <p className="text-muted-foreground text-xs">
                              {row.activePayment.paymentMethod}
                            </p>
                          )}
                          {row.authorizationNumber && (
                            <p className="text-muted-foreground text-xs">
                              Nº {row.authorizationNumber}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowAction
                        row={row}
                        summary={`${row.patient.lastName}, ${row.patient.firstName} · ${row.professional.lastName}, ${row.professional.firstName} · ${row.service.name} · ${formatDate(today)}, ${schedule(row)}`}
                        paymentMethods={paymentMethods}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Solo hay acción cuando falta cobrar o autorizar. Para anular un cobro o
// corregir una autorización se entra al detalle del turno.
function RowAction({
  row,
  summary,
  paymentMethods,
}: {
  row: TodayRow;
  summary: string;
  paymentMethods: Awaited<ReturnType<typeof listActivePaymentMethods>>;
}) {
  if (row.state === "PENDING_AUTHORIZATION")
    return (
      <AuthorizationDialog
        appointmentId={row.id}
        successHref={`/today?authorized=${row.id}`}
        triggerClassName="h-8"
        summary={summary}
        currentNumber={null}
      />
    );
  if (row.state === "PAID" && row.activePayment)
    return (
      <Button variant="outline" size="sm" className="h-8" asChild>
        <Link href={`/payments/${row.activePayment.id}/receipt`}>
          Comprobante
        </Link>
      </Button>
    );
  if (row.state !== "PENDING_PAYMENT") return null;
  if (row.price === null)
    return (
      <Badge
        variant="outline"
        className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border"
      >
        Sin valor cargado
      </Badge>
    );
  return (
    <PaymentDialog
      appointmentId={row.id}
      successHref={`/today?paid=${row.id}`}
      triggerClassName="h-8"
      summary={summary}
      price={row.price}
      paymentMethods={paymentMethods}
    />
  );
}
