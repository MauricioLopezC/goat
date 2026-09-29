import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requirePageRole } from "@/lib/dal/auth";
import { listTodayBilling } from "@/lib/dal/payments";
import { listActivePaymentMethods } from "@/lib/dal/payment-methods";
import {
  PAYMENT_STATE_BADGE_CLASS,
  PAYMENT_STATE_LABEL,
  formatAmount,
} from "@/lib/payments";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/appointment-status";
import { COVERAGE_TYPE_LABEL } from "@/lib/patients";
import { formatDate, formatMinute, toLocalSlot } from "@/lib/schedule";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const metadata: Metadata = { title: "Cobros del día · Goat" };

type BillingRow = Awaited<ReturnType<typeof listTodayBilling>>[number];

function isPending(row: BillingRow) {
  return (
    row.state === "PENDING_PAYMENT" || row.state === "PENDING_AUTHORIZATION"
  );
}

function schedule(row: BillingRow) {
  const start = toLocalSlot(row.startsAt);
  const end = toLocalSlot(row.endsAt);
  return `${formatMinute(start.minute)}–${formatMinute(end.minute)}`;
}

// Cobros del día (HU-21): los turnos de hoy pendientes de cobro o de
// autorización, con la acción en la misma fila, y los ya resueltos.
export default async function PaymentsPage({
  searchParams,
}: PageProps<"/payments">) {
  const actor = await requirePageRole("RECEPTIONIST", "MANAGER");
  const { paid, authorized } = await searchParams;
  const rows = await listTodayBilling(actor);
  const pending = rows.filter(isPending);
  const resolved = rows.filter((row) => !isPending(row));
  const paymentMethods = pending.some(
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
          Cobros del día
        </h1>
        <p className="text-body-lg text-muted-foreground mt-1">
          Turnos de hoy, {formatDate(today)}, pendientes de cobro o de
          autorización de la obra social.
        </p>
      </div>

      {paidRow?.activePayment && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>
            Cobro registrado: {formatAmount(paidRow.activePayment.amount)}
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
        <CardHeader>
          <CardTitle>Pendientes ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground">
              No hay turnos de hoy pendientes de cobro ni de autorización.
            </p>
          ) : (
            <BillingTable
              rows={pending}
              action={(row) => {
                const summary = `${row.patient.lastName}, ${row.patient.firstName} · ${row.professional.lastName}, ${row.professional.firstName} · ${row.service.name} · ${formatDate(today)}, ${schedule(row)}`;
                if (row.state === "PENDING_AUTHORIZATION")
                  return (
                    <AuthorizationDialog
                      appointmentId={row.id}
                      successHref={`/payments?authorized=${row.id}`}
                      triggerClassName="h-8"
                      summary={summary}
                      currentNumber={null}
                    />
                  );
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
                    successHref={`/payments?paid=${row.id}`}
                    triggerClassName="h-8"
                    summary={summary}
                    price={row.price}
                    paymentMethods={paymentMethods}
                  />
                );
              }}
            />
          )}
        </CardContent>
      </Card>

      {resolved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cobrados y autorizados ({resolved.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <BillingTable
              rows={resolved}
              action={(row) => (
                <Button asChild variant="outline" className="h-8">
                  <Link href={`/appointments/${row.id}`}>Ver turno</Link>
                </Button>
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BillingTable({
  rows,
  action,
}: {
  rows: BillingRow[];
  action: (row: BillingRow) => ReactNode;
}) {
  return (
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
              <p className="text-muted-foreground text-xs">
                Turno {APPOINTMENT_STATUS_LABEL[row.status].toLowerCase()}
              </p>
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
                {row.professional.lastName}, {row.professional.firstName}
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
              ) : row.state === "PENDING_PAYMENT" && row.price !== null ? (
                formatAmount(row.price)
              ) : row.state === "PENDING_PAYMENT" ? (
                <span className="text-muted-foreground">Sin valor</span>
              ) : (
                <span className="text-muted-foreground">No se cobra</span>
              )}
            </TableCell>
            <TableCell>
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
            </TableCell>
            <TableCell className="text-right">{action(row)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
