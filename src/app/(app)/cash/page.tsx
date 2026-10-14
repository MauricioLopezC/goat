import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/logo-goat.png";
import { centerProfile } from "@/lib/center-profile";
import { requirePageRole } from "@/lib/dal/auth";
import { getCashSummary, getUnclosedCashDays } from "@/lib/dal/cash";
import { formatAmount } from "@/lib/payments";
import {
  formatDate,
  formatInstant,
  formatMinute,
  isCalendarDate,
  toLocalSlot,
} from "@/lib/schedule";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DomainError } from "@/lib/actions";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  History,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import { CloseCashDialog } from "./close-cash-dialog";
import { VoidClosedPaymentDialog } from "./void-closed-payment-dialog";
import { PrintSummaryButton } from "./print-summary-button";

export const metadata: Metadata = { title: "Caja · Goat" };

// Pantalla Caja (HU-27).
// Muestra la caja del día en vivo, con desglose por medio de pago y por profesional,
// o el resumen de la caja cerrada con sus ajustes posteriores si ya fue cerrada.
export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; closed?: string }>;
}) {
  const actor = await requirePageRole("RECEPTIONIST", "MANAGER");
  const { date, closed } = await searchParams;
  const today = toLocalSlot(new Date()).date;
  const targetDate = date && isCalendarDate(date) ? date : today;

  let cashSummary;
  try {
    cashSummary = await getCashSummary(targetDate, actor);
  } catch (error) {
    if (
      error instanceof DomainError &&
      error.code === "FORBIDDEN" &&
      targetDate !== today &&
      actor.role !== "MANAGER"
    ) {
      return (
        <div className="flex flex-col gap-6">
          <Alert className="bg-info-soft text-info-soft-foreground border-info-soft-border">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Caja cerrada histórica</AlertTitle>
            <AlertDescription className="mt-1 flex flex-col gap-3">
              <p>
                La caja del día {formatDate(targetDate)} ya se encuentra
                cerrada. Solo la gerencia puede consultar el detalle de cajas
                cerradas de fechas anteriores.
              </p>
              <div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/cash">Volver a la caja de hoy</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    throw error;
  }

  const unclosedDays = await getUnclosedCashDays(actor);
  const isToday = targetDate === today;

  return (
    <div className="flex flex-col gap-6">
      {/* Mensaje de caja cerrada con éxito */}
      {closed && isCalendarDate(closed) && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border print:hidden">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Caja cerrada exitosamente</AlertTitle>
          <AlertDescription>
            La caja del día {formatDate(closed)} fue cerrada correctamente y
            guardada en el historial contable.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de días anteriores sin cerrar */}
      {unclosedDays.length > 0 && (
        <Alert className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border print:hidden">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cajas anteriores sin cerrar</AlertTitle>
          <AlertDescription className="text-warning-soft-foreground flex flex-col gap-1.5 mt-1">
            <p>
              Hay días anteriores con cobros registrados que todavía no fueron
              cerrados. Cerrar la caja garantiza el arqueo correcto:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {unclosedDays.map((d) => (
                <Link
                  key={d}
                  href={`/cash?date=${d}`}
                  className="inline-flex items-center gap-1 rounded bg-background/80 px-2.5 py-1 text-xs font-semibold text-warning-soft-foreground hover:bg-background border border-warning-soft-border hover:underline"
                >
                  Cerrar caja del {formatDate(d)} →
                </Link>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Botón para volver a la caja de hoy cuando se consulta una fecha anterior */}
      {!isToday && (
        <div className="print:hidden -mb-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <Link href="/cash">
              <ArrowLeft className="h-4 w-4" />
              Volver a la caja de hoy
            </Link>
          </Button>
        </div>
      )}

      {/* Encabezado institucional exclusivo para impresión */}
      <div className="hidden print:flex flex-col border-b pb-6 mb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={logo}
              width={48}
              height={48}
              alt={centerProfile.name}
              className="size-12 shrink-0 rounded-xl"
              priority
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {centerProfile.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {centerProfile.legalName}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">
              CUIT {centerProfile.cuit}
            </p>
            <p>{centerProfile.address}</p>
            <p>Tel: {centerProfile.phone}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
              Planilla de Cierre de Caja
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fecha de la caja:{" "}
              <strong className="text-foreground">
                {formatDate(targetDate)}
              </strong>
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              Estado:{" "}
              <strong className="text-foreground uppercase">
                {cashSummary.isClosed ? "Cerrada" : "Abierta (en vivo)"}
              </strong>
            </p>
            {cashSummary.isClosed && cashSummary.closing ? (
              <p>
                Cerrada por: {cashSummary.closing.closedBy.firstName}{" "}
                {cashSummary.closing.closedBy.lastName} ·{" "}
                {formatInstant(cashSummary.closing.closedAt)}
              </p>
            ) : (
              <p>Impreso el {formatInstant(new Date())}</p>
            )}
          </div>
        </div>
      </div>

      {/* Cabecera de pantalla */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-lg font-semibold tracking-tight text-foreground">
              Caja
            </h1>
            {cashSummary.isClosed ? (
              <Badge
                variant="outline"
                className="bg-success-soft text-success-soft-foreground border-success-soft-border"
              >
                Cerrada
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-scheduled-soft text-scheduled-soft-foreground border-scheduled-soft-border"
              >
                Abierta (en vivo)
              </Badge>
            )}
            {!isToday && (
              <Badge variant="secondary" className="font-normal text-xs">
                Fecha anterior
              </Badge>
            )}
          </div>
          <p className="text-body-lg text-muted-foreground mt-1">
            {formatDate(targetDate)}
            {isToday ? " (Hoy)" : ""}
            {cashSummary.isClosed && cashSummary.closing && (
              <>
                {" "}
                · Cerrada por{" "}
                <span className="font-medium text-foreground">
                  {cashSummary.closing.closedBy.firstName}{" "}
                  {cashSummary.closing.closedBy.lastName}
                </span>{" "}
                el {formatInstant(cashSummary.closing.closedAt)}
              </>
            )}
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 print:hidden">
          {actor.role === "MANAGER" && (
            <Button variant="outline" asChild>
              <Link href="/cash/history">
                <History className="h-4 w-4 mr-1.5" />
                Historial de cajas
              </Link>
            </Button>
          )}

          {cashSummary.isClosed ? (
            <PrintSummaryButton />
          ) : (
            <CloseCashDialog
              date={targetDate}
              expectedCashAmount={cashSummary.summary.expectedCashAmount}
              totalAmount={cashSummary.summary.totalAmount}
              paymentCount={cashSummary.summary.paymentCount}
              actorRole={actor.role}
              isToday={isToday}
            />
          )}
        </div>
      </div>

      {/* Tarjetas métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total cobrado */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Cobrado
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {cashSummary.isClosed &&
              cashSummary.correctedTotals &&
              cashSummary.correctedTotals.correctedTotalAmount !==
                cashSummary.closing?.totalAmount ? (
                <div className="flex flex-col">
                  <span>
                    {formatAmount(
                      cashSummary.correctedTotals.correctedTotalAmount,
                    )}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground line-through">
                    Original: {formatAmount(cashSummary.closing!.totalAmount)}
                  </span>
                </div>
              ) : (
                formatAmount(cashSummary.summary.totalAmount)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {cashSummary.isClosed && cashSummary.correctedTotals ? (
                <>
                  {cashSummary.correctedTotals.correctedPaymentCount}{" "}
                  {cashSummary.correctedTotals.correctedPaymentCount === 1
                    ? "cobro vigente"
                    : "cobros vigentes"}
                  {cashSummary.subsequentAdjustments.length > 0 &&
                    ` (${cashSummary.subsequentAdjustments.length} anulado post-cierre)`}
                </>
              ) : (
                <>
                  {cashSummary.summary.paymentCount}{" "}
                  {cashSummary.summary.paymentCount === 1
                    ? "cobro registrado"
                    : "cobros registrados"}
                </>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Efectivo esperado */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Efectivo Esperado
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {cashSummary.isClosed &&
              cashSummary.correctedTotals &&
              cashSummary.correctedTotals.correctedCashAmount !==
                cashSummary.closing?.expectedCashAmount ? (
                <div className="flex flex-col">
                  <span>
                    {formatAmount(
                      cashSummary.correctedTotals.correctedCashAmount,
                    )}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground line-through">
                    Original:{" "}
                    {formatAmount(cashSummary.closing!.expectedCashAmount)}
                  </span>
                </div>
              ) : (
                formatAmount(cashSummary.summary.expectedCashAmount)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total cobrado con medio Efectivo
            </p>
          </CardContent>
        </Card>

        {/* Efectivo contado */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Efectivo Contado
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {cashSummary.isClosed && cashSummary.closing ? (
                formatAmount(cashSummary.closing.countedCashAmount)
              ) : (
                <span className="text-muted-foreground text-lg font-normal">
                  Pendiente de cierre
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {cashSummary.isClosed
                ? "Declarado al momento del arqueo"
                : "Se ingresa al cerrar la caja"}
            </p>
          </CardContent>
        </Card>

        {/* Diferencia */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Diferencia de Caja
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {cashSummary.isClosed && cashSummary.closing ? (
                <div className="flex items-center gap-2">
                  <span>{formatAmount(cashSummary.closing.difference)}</span>
                  {Number(cashSummary.closing.difference) === 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-success-soft text-success-soft-foreground border-success-soft-border text-xs font-normal"
                    >
                      Exacto
                    </Badge>
                  ) : Number(cashSummary.closing.difference) < 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border text-xs font-normal"
                    >
                      Faltante
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-info-soft text-info-soft-foreground border-info-soft-border text-xs font-normal"
                    >
                      Sobrante
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-lg font-normal">
                  —
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {cashSummary.isClosed
                ? "Contado menos esperado"
                : "Calculada al cerrar"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Observaciones del cierre si existen */}
      {cashSummary.isClosed && cashSummary.closing?.notes && (
        <Card className="bg-muted/20">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Observaciones del cierre
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4 pb-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {cashSummary.closing.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tablas de desglose (Medios de pago y Profesionales) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Desglose por Medio de Pago */}
        <Card>
          <CardHeader>
            <CardTitle className="text-title-lg">
              Total por medio de pago
            </CardTitle>
            <CardDescription>
              Recaudación discriminada por cada medio de pago
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cashSummary.summary.byPaymentMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cobros registrados en esta fecha.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Medio de pago</TableHead>
                    <TableHead className="text-center">Cobros</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashSummary.summary.byPaymentMethod.map((m) => (
                    <TableRow key={m.paymentMethodId}>
                      <TableCell className="font-medium">
                        {m.paymentMethodName}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {m.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatAmount(m.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Desglose por Profesional */}
        <Card>
          <CardHeader>
            <CardTitle className="text-title-lg">
              Total por profesional
            </CardTitle>
            <CardDescription>
              Por los turnos particulares atendidos y cobrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cashSummary.summary.byProfessional.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cobros registrados en esta fecha.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Profesional</TableHead>
                    <TableHead className="text-center">Cobros</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashSummary.summary.byProfessional.map((p) => (
                    <TableRow key={p.professionalId}>
                      <TableCell className="font-medium">
                        {p.professionalName}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {p.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatAmount(p.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de cobros del día */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title-lg flex items-center justify-between">
            <span>Cobros del día ({cashSummary.payments.length})</span>
          </CardTitle>
          <CardDescription>
            Lista de cobros vigentes incluidos en la caja
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cashSummary.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay cobros vigentes registrados para esta fecha.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profesional · Servicio</TableHead>
                  <TableHead>Medio de pago</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="text-right print:hidden">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashSummary.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs tabular-nums font-semibold">
                      #{String(p.receiptNumber).padStart(6, "0")}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {formatMinute(toLocalSlot(p.createdAt).minute)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/appointments/${p.appointment.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.appointment.patient.lastName},{" "}
                        {p.appointment.patient.firstName}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono">
                        {p.appointment.patient.documentType}{" "}
                        {p.appointment.patient.documentNumber}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {p.appointment.professional.lastName},{" "}
                        {p.appointment.professional.firstName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.appointment.service.name}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal text-xs">
                        {p.paymentMethod.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatAmount(p.amount)}
                    </TableCell>
                    <TableCell className="text-right print:hidden">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 px-2 text-xs"
                        >
                          <Link href={`/payments/${p.id}/receipt`}>
                            <Receipt className="h-3.5 w-3.5 mr-1" />
                            Comprobante
                          </Link>
                        </Button>
                        {cashSummary.isClosed && actor.role === "MANAGER" && (
                          <VoidClosedPaymentDialog
                            paymentId={p.id}
                            description={`Comprobante #${String(p.receiptNumber).padStart(6, "0")} (${formatAmount(p.amount)} con ${p.paymentMethod.name})`}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cobros anulados en el día */}
      {cashSummary.voidedPayments.length > 0 && (
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-title-lg text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              Cobros anulados en el día ({cashSummary.voidedPayments.length})
            </CardTitle>
            <CardDescription>
              Cobros anulados durante la jornada antes del cierre
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Anulado por</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right print:hidden">
                    <span className="sr-only">Comprobante</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashSummary.voidedPayments.map((p) => (
                  <TableRow key={p.id} className="text-muted-foreground">
                    <TableCell className="font-mono text-xs tabular-nums line-through">
                      #{String(p.receiptNumber).padStart(6, "0")}
                    </TableCell>
                    <TableCell>
                      {p.appointment.patient.lastName},{" "}
                      {p.appointment.patient.firstName}
                    </TableCell>
                    <TableCell>
                      {p.appointment.professional.lastName},{" "}
                      {p.appointment.professional.firstName}
                    </TableCell>
                    <TableCell className="tabular-nums line-through">
                      {formatAmount(p.amount)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.voidedBy
                        ? `${p.voidedBy.firstName} ${p.voidedBy.lastName}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate">
                      {p.voidReason || "—"}
                    </TableCell>
                    <TableCell className="text-right print:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 px-2 text-xs"
                      >
                        <Link href={`/payments/${p.id}/receipt`}>
                          Comprobante
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Ajustes posteriores de gerencia */}
      {cashSummary.subsequentAdjustments.length > 0 && (
        <Card className="border-warning-soft-border bg-warning-soft/20">
          <CardHeader>
            <CardTitle className="text-title-lg text-warning-soft-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Ajustes posteriores de gerencia (
              {cashSummary.subsequentAdjustments.length})
            </CardTitle>
            <CardDescription>
              Cobros pertenecientes a esta caja que fueron anulados por el
              gerente con posterioridad al cierre
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Importe deducido</TableHead>
                  <TableHead>Anulado por</TableHead>
                  <TableHead>Fecha de anulación</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right print:hidden">
                    <span className="sr-only">Comprobante</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashSummary.subsequentAdjustments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs tabular-nums line-through">
                      #{String(p.receiptNumber).padStart(6, "0")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.appointment.patient.lastName},{" "}
                      {p.appointment.patient.firstName}
                    </TableCell>
                    <TableCell>
                      {p.appointment.professional.lastName},{" "}
                      {p.appointment.professional.firstName}
                    </TableCell>
                    <TableCell className="tabular-nums font-bold text-destructive">
                      -{formatAmount(p.amount)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.voidedBy
                        ? `${p.voidedBy.firstName} ${p.voidedBy.lastName}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {p.voidedAt ? formatInstant(p.voidedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.voidReason || "—"}
                    </TableCell>
                    <TableCell className="text-right print:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 px-2 text-xs"
                      >
                        <Link href={`/payments/${p.id}/receipt`}>
                          Comprobante
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sección de firmas formal para la rendición impresa */}
      <div className="hidden print:grid grid-cols-2 gap-12 pt-16 mt-8 border-t border-border">
        <div className="flex flex-col items-center text-center">
          <div className="w-48 border-b border-foreground mb-2" />
          <span className="text-xs font-semibold text-foreground">
            Firma Responsable de Caja
          </span>
          <span className="text-xs text-muted-foreground">
            Mesa de Entradas
          </span>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-48 border-b border-foreground mb-2" />
          <span className="text-xs font-semibold text-foreground">
            Firma de Conformidad / Control
          </span>
          <span className="text-xs text-muted-foreground">
            Gerencia / Administración
          </span>
        </div>
      </div>
    </div>
  );
}
