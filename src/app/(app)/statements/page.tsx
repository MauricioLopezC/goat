import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  UserCheck,
  Users,
} from "lucide-react";
import { requirePageRole } from "@/lib/dal/auth";
import { getProfessionalStatement } from "@/lib/dal/statements";
import {
  defaultStatementPeriod,
  formatStatementPeriod,
} from "@/lib/statements";
import { statementFilterSchema } from "@/lib/validation/statements";
import { centerProfile, formatReceiptNumber } from "@/lib/center-profile";
import { formatAmount } from "@/lib/payments";
import { formatInstant } from "@/lib/schedule";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = {
  title: "Rendiciones · GOAT",
};

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function statementsHref(
  period: { from: string; to: string },
  professionalId?: number,
): string {
  const search = new URLSearchParams({ from: period.from, to: period.to });
  if (professionalId) {
    search.set("professional", String(professionalId));
  }
  return `/statements?${search.toString()}`;
}

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    professional?: string;
  }>;
}) {
  const actor = await requirePageRole("MANAGER", "PROFESSIONAL");
  const params = await searchParams;

  const fallback = defaultStatementPeriod();
  const rawFrom = single(params.from) ?? fallback.from;
  const rawTo = single(params.to) ?? fallback.to;

  const profParam = single(params.professional);
  const rawProfId =
    profParam && /^\d{1,9}$/.test(profParam) ? Number(profParam) : undefined;

  const validation = statementFilterSchema.safeParse({
    from: rawFrom,
    to: rawTo,
    professionalId: rawProfId,
  });

  const periodError = validation.success
    ? null
    : (validation.error.issues[0]?.message ??
      "Revisá el período de fechas seleccionado.");

  const inputFilter = validation.success
    ? validation.data
    : { ...fallback, professionalId: rawProfId };

  let statementData;
  try {
    statementData = await getProfessionalStatement(inputFilter, actor);
  } catch (err) {
    // Si el profesional seleccionado no se encontró, fallback a todos
    if (inputFilter.professionalId) {
      statementData = await getProfessionalStatement(
        { ...inputFilter, professionalId: undefined },
        actor,
      );
    } else {
      throw err;
    }
  }

  const {
    period,
    isManager,
    centerTotals,
    professionalsSummary,
    professionalOptions,
    selectedStatement,
  } = statementData;

  const pageTitle =
    actor.role === "PROFESSIONAL" ? "Mi rendición" : "Rendiciones";

  const selectedProfName = selectedStatement
    ? `${selectedStatement.professional.lastName}, ${selectedStatement.professional.firstName}`
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera institucional para impresión (visible únicamente al imprimir o guardar en PDF) */}
      <div className="hidden border-b pb-4 print:block">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {centerProfile.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {centerProfile.legalName} · CUIT {centerProfile.cuit}
            </p>
            <p className="text-xs text-muted-foreground">
              {centerProfile.address} · Tel. {centerProfile.phone}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Rendición por profesional
            </h2>
            <p className="text-xs font-medium text-foreground">
              Período: {formatStatementPeriod(period.from, period.to)}
            </p>
            {selectedProfName && (
              <p className="text-xs text-muted-foreground">
                Profesional: {selectedProfName}
                {selectedStatement?.professional.licenseNumber &&
                  ` (MN ${selectedStatement.professional.licenseNumber})`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Encabezado en pantalla */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-headline-lg">{pageTitle}</h1>
          <p className="text-muted-foreground">
            {formatStatementPeriod(period.from, period.to)}
            {selectedProfName && ` · ${selectedProfName}`}
            {!selectedProfName && isManager && " · Todos los profesionales"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
        </div>
      </div>

      {/* Formulario de filtros de período y profesional (oculto en impresión) */}
      <form
        key={`${period.from}-${period.to}-${selectedStatement?.professional.id ?? ""}`}
        action="/statements"
        method="GET"
        className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4 shadow-xs print:hidden"
      >
        <Field className="w-auto">
          <FieldLabel htmlFor="filter-from">Desde</FieldLabel>
          <Input
            id="filter-from"
            name="from"
            type="date"
            defaultValue={period.from}
            className="w-40"
            required
          />
        </Field>

        <Field className="w-auto">
          <FieldLabel htmlFor="filter-to">Hasta</FieldLabel>
          <Input
            id="filter-to"
            name="to"
            type="date"
            defaultValue={period.to}
            className="w-40"
            required
          />
        </Field>

        {isManager && (
          <Field className="w-auto">
            <FieldLabel htmlFor="filter-professional">Profesional</FieldLabel>
            <NativeSelect
              id="filter-professional"
              name="professional"
              defaultValue={
                selectedStatement
                  ? String(selectedStatement.professional.id)
                  : ""
              }
            >
              <NativeSelectOption value="">
                Todos los profesionales
              </NativeSelectOption>
              {professionalOptions.map((prof) => (
                <NativeSelectOption key={prof.id} value={String(prof.id)}>
                  {prof.lastName}, {prof.firstName}
                  {!prof.active ? " (de baja)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}

        <Button type="submit">Consultar</Button>

        <Button asChild variant="outline">
          <Link href="/statements">Mes en curso</Link>
        </Button>

        {isManager && selectedStatement && (
          <Button asChild variant="ghost">
            <Link href={statementsHref(period)}>
              Ver todos los profesionales
            </Link>
          </Button>
        )}

        <p className="text-muted-foreground basis-full text-xs">
          El período puede abarcar un mes o un rango de fechas de hasta tres
          meses. Por defecto, el mes en curso.
        </p>
      </form>

      {/* Aviso de error en el período */}
      {periodError && (
        <Alert className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border print:hidden">
          <AlertTitle>Período ajustado</AlertTitle>
          <AlertDescription className="text-warning-soft-foreground">
            {periodError} Se muestra el mes en curso por defecto.
          </AlertDescription>
        </Alert>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 1: Consolidado de todos los profesionales (solo GERENTE)
          ───────────────────────────────────────────────────────────── */}
      {isManager && !selectedStatement && (
        <>
          {/* Tarjetas de totales del centro */}
          {centerTotals && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Producido total
                  </CardTitle>
                  <Users className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {centerTotals.patientsAttended}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Pacientes atendidos en el período
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Cobrado particulares
                  </CardTitle>
                  <DollarSign className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums text-foreground">
                    {formatAmount(centerTotals.totalBilled)}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Cobros vigentes a pacientes particulares
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Comisión del centro (15 %)
                  </CardTitle>
                  <Building2 className="text-primary size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-primary text-2xl font-bold tabular-nums">
                    {formatAmount(centerTotals.centerCommission)}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Por uso de instalaciones y servicios
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Neto a profesionales
                  </CardTitle>
                  <UserCheck className="text-success size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-success text-2xl font-bold tabular-nums">
                    {formatAmount(centerTotals.professionalNet)}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Total a liquidar (Cobrado - Comisión)
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabla de profesionales del centro */}
          <Card className="print:border-none print:shadow-none print:ring-0 print:p-0 print:overflow-visible">
            <CardHeader className="print:px-0 print:pb-2">
              <CardTitle>Rendición por profesional</CardTitle>
              <CardDescription className="print:hidden">
                Hacé clic en cualquier profesional para ver su detalle de
                atenciones por servicio, cobertura, medios de pago y turnos.
              </CardDescription>
            </CardHeader>
            <CardContent className="print:p-0 print:overflow-visible">
              {!professionalsSummary || professionalsSummary.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center">
                  No hay profesionales con atenciones registradas en el período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profesional</TableHead>
                      <TableHead className="text-right">
                        Producido (Atendidos)
                      </TableHead>
                      <TableHead className="text-right">Cobrado</TableHead>
                      <TableHead className="text-right">
                        Comisión centro (15 %)
                      </TableHead>
                      <TableHead className="text-right">
                        Neto profesional
                      </TableHead>
                      <TableHead className="text-right print:hidden">
                        Acción
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {professionalsSummary.map((prof) => (
                      <TableRow key={prof.professionalId}>
                        <TableCell>
                          <Link
                            href={statementsHref(period, prof.professionalId)}
                            className="font-medium hover:underline"
                          >
                            {prof.lastName}, {prof.firstName}
                          </Link>
                          {prof.licenseNumber && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              (MN {prof.licenseNumber})
                            </span>
                          )}
                          {!prof.active && (
                            <Badge
                              variant="outline"
                              className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border ml-2 text-xs"
                            >
                              De baja
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {prof.patientsAttended}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(prof.totalBilled)}
                        </TableCell>
                        <TableCell className="text-primary text-right font-medium tabular-nums">
                          {formatAmount(prof.centerCommission)}
                        </TableCell>
                        <TableCell className="text-success text-right font-semibold tabular-nums">
                          {formatAmount(prof.professionalNet)}
                        </TableCell>
                        <TableCell className="text-right print:hidden">
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={statementsHref(period, prof.professionalId)}
                            >
                              Ver detalle
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {centerTotals && (
                    <TableFooter>
                      <TableRow className="font-semibold">
                        <TableCell>Totales del centro</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {centerTotals.patientsAttended}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(centerTotals.totalBilled)}
                        </TableCell>
                        <TableCell className="text-primary text-right tabular-nums">
                          {formatAmount(centerTotals.centerCommission)}
                        </TableCell>
                        <TableCell className="text-success text-right tabular-nums">
                          {formatAmount(centerTotals.professionalNet)}
                        </TableCell>
                        <TableCell className="print:hidden" />
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 2: Rendición individual del profesional
          ───────────────────────────────────────────────────────────── */}
      {selectedStatement && (
        <div className="flex flex-col gap-6">
          {/* Botón para volver al listado general (solo para gerente) */}
          {isManager && (
            <div className="print:hidden">
              <Button asChild variant="outline" size="sm">
                <Link href={statementsHref(period)}>
                  <ArrowLeft className="size-4" />
                  Volver a todos los profesionales
                </Link>
              </Button>
            </div>
          )}

          {/* Encabezado del profesional */}
          <div className="bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  {selectedStatement.professional.lastName},{" "}
                  {selectedStatement.professional.firstName}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {selectedStatement.professional.licenseNumber
                    ? `Matrícula: MN ${selectedStatement.professional.licenseNumber}`
                    : "Sin matrícula cargada"}
                </p>
              </div>
              <div className="mt-2 sm:mt-0">
                {selectedStatement.professional.active ? (
                  <Badge
                    variant="outline"
                    className="bg-success-soft text-success-soft-foreground border-success-soft-border"
                  >
                    Profesional activo
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border"
                  >
                    Profesional de baja
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Tarjetas resumen del profesional */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Producido</CardTitle>
                <Users className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {selectedStatement.summary.patientsAttended}
                </div>
                <p className="text-muted-foreground text-xs">
                  Pacientes atendidos (particulares y OS)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Cobrado</CardTitle>
                <DollarSign className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {formatAmount(selectedStatement.summary.totalBilled)}
                </div>
                <p className="text-muted-foreground text-xs">
                  Total cobrado a particulares
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Comisión centro (15 %)
                </CardTitle>
                <Building2 className="text-primary size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-primary text-2xl font-bold tabular-nums">
                  {formatAmount(selectedStatement.summary.centerCommission)}
                </div>
                <p className="text-muted-foreground text-xs">
                  Por uso de instalaciones
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Neto a percibir
                </CardTitle>
                <UserCheck className="text-success size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-success text-2xl font-bold tabular-nums">
                  {formatAmount(selectedStatement.summary.professionalNet)}
                </div>
                <p className="text-muted-foreground text-xs">
                  Total neto (Cobrado - Comisión)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Grilla de desgloses: Servicios, Coberturas, Medios de Pago */}
          <div className="grid gap-6 md:grid-cols-3 print:grid-cols-3 print:gap-3">
            {/* Desglose por Servicio */}
            <Card className="print:shadow-none print:ring-1 print:ring-border print:overflow-visible">
              <CardHeader className="pb-3 print:p-2 print:pb-1">
                <CardTitle className="text-base print:text-xs">
                  Detalle por servicio
                </CardTitle>
                <CardDescription className="text-xs print:hidden">
                  Prestaciones brindadas en el período
                </CardDescription>
              </CardHeader>
              <CardContent className="print:p-2 print:pt-0">
                {selectedStatement.byService.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-xs">
                    Sin atenciones registradas.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Servicio</TableHead>
                        <TableHead className="text-right text-xs">
                          Atendidos
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStatement.byService.map((item) => (
                        <TableRow key={item.serviceId}>
                          <TableCell className="text-xs font-medium">
                            {item.serviceName}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {item.count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Desglose por Cobertura */}
            <Card className="print:shadow-none print:ring-1 print:ring-border print:overflow-visible">
              <CardHeader className="pb-3 print:p-2 print:pb-1">
                <CardTitle className="text-base print:text-xs">
                  Detalle por cobertura
                </CardTitle>
                <CardDescription className="text-xs print:hidden">
                  Particulares vs. Obras sociales
                </CardDescription>
              </CardHeader>
              <CardContent className="print:p-2 print:pt-0">
                {selectedStatement.byCoverage.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-xs">
                    Sin atenciones registradas.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs print:text-[10px] print:p-1">
                          Cobertura
                        </TableHead>
                        <TableHead className="text-right text-xs print:text-[10px] print:p-1">
                          Atendidos
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStatement.byCoverage.map((item) => (
                        <TableRow key={item.label}>
                          <TableCell className="text-xs font-medium print:text-[10px] print:p-1">
                            {item.label}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums print:text-[10px] print:p-1">
                            {item.count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Desglose por Medio de Pago */}
            <Card className="print:shadow-none print:ring-1 print:ring-border print:overflow-visible">
              <CardHeader className="pb-3 print:p-2 print:pb-1">
                <CardTitle className="text-base print:text-xs">
                  Detalle por medio de pago
                </CardTitle>
                <CardDescription className="text-xs print:hidden">
                  Ingresos particulares según medio
                </CardDescription>
              </CardHeader>
              <CardContent className="print:p-2 print:pt-0">
                {selectedStatement.byPaymentMethod.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-xs">
                    Sin cobros registrados a particulares.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs print:text-[10px] print:p-1">
                          Medio
                        </TableHead>
                        <TableHead className="text-right text-xs print:text-[10px] print:p-1">
                          Cobros
                        </TableHead>
                        <TableHead className="text-right text-xs print:text-[10px] print:p-1">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStatement.byPaymentMethod.map((item) => (
                        <TableRow key={item.paymentMethodId}>
                          <TableCell className="text-xs font-medium print:text-[10px] print:p-1">
                            {item.name}
                            {item.isCash && (
                              <span className="text-muted-foreground ml-1 text-[10px]">
                                (Efvo.)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums print:text-[10px] print:p-1">
                            {item.count}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium tabular-nums print:text-[10px] print:p-1">
                            {formatAmount(item.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lista detallada de turnos atendidos y su cobro */}
          <Card className="print:border-none print:shadow-none print:ring-0 print:p-0 print:overflow-visible">
            <CardHeader className="print:px-0 print:pb-2">
              <CardTitle className="text-base print:text-sm font-semibold">
                Lista de turnos atendidos
              </CardTitle>
              <CardDescription className="print:hidden">
                Registro de turnos completados con su cobro a pacientes
                particulares, cálculo de comisión y neto.
              </CardDescription>
            </CardHeader>
            <CardContent className="print:px-0 print:overflow-visible">
              {selectedStatement.appointments.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  No se registraron turnos completados para este profesional en
                  el período seleccionado.
                </p>
              ) : (
                <Table className="print:text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="print:px-1.5 print:py-1 print:text-[11px]">
                        Fecha y hora
                      </TableHead>
                      <TableHead className="print:px-1.5 print:py-1 print:text-[11px]">
                        Paciente
                      </TableHead>
                      <TableHead className="print:px-1.5 print:py-1 print:text-[11px]">
                        Servicio
                      </TableHead>
                      <TableHead className="print:px-1.5 print:py-1 print:text-[11px]">
                        Cobertura
                      </TableHead>
                      <TableHead className="print:px-1.5 print:py-1 print:text-[11px]">
                        Comprobante
                      </TableHead>
                      <TableHead className="print:px-1.5 print:py-1 print:text-[11px]">
                        Medio de pago
                      </TableHead>
                      <TableHead className="text-right print:px-1.5 print:py-1 print:text-[11px]">
                        Cobrado
                      </TableHead>
                      <TableHead className="text-right print:px-1.5 print:py-1 print:text-[11px]">
                        Comisión (15 %)
                      </TableHead>
                      <TableHead className="text-right print:px-1.5 print:py-1 print:text-[11px]">
                        Neto
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedStatement.appointments.map((appt) => (
                      <TableRow key={appt.id}>
                        <TableCell className="text-xs print:px-1.5 print:py-1 print:text-[11px] whitespace-nowrap">
                          {formatInstant(appt.startsAt)}
                        </TableCell>
                        <TableCell className="print:px-1.5 print:py-1 print:text-[11px]">
                          <div className="font-medium">
                            {appt.patient.lastName}, {appt.patient.firstName}
                          </div>
                          <div className="text-muted-foreground text-xs print:text-[10px]">
                            {appt.patient.documentType}{" "}
                            {appt.patient.documentNumber}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs print:px-1.5 print:py-1 print:text-[11px]">
                          {appt.service.name}
                        </TableCell>
                        <TableCell className="text-xs print:px-1.5 print:py-1 print:text-[11px]">
                          <div>{appt.coverage.label}</div>
                          {appt.coverage.memberNumber && (
                            <div className="text-muted-foreground text-[11px] print:text-[10px]">
                              Nº {appt.coverage.memberNumber}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums print:px-1.5 print:py-1 print:text-[11px]">
                          {appt.payment ? (
                            <span className="font-medium">
                              {formatReceiptNumber(appt.payment.receiptNumber)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs print:px-1.5 print:py-1 print:text-[11px]">
                          {appt.payment ? (
                            <span>{appt.payment.paymentMethodName}</span>
                          ) : (
                            <span className="text-muted-foreground">
                              {appt.coverage.coverageType === "HEALTH_INSURANCE"
                                ? "Obra social"
                                : "Pendiente"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-xs print:px-1.5 print:py-1 print:text-[11px]">
                          {appt.payment ? (
                            formatAmount(appt.payment.amount)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-primary text-right font-medium tabular-nums text-xs print:px-1.5 print:py-1 print:text-[11px]">
                          {appt.commission ? (
                            formatAmount(appt.commission)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-success text-right font-semibold tabular-nums text-xs print:px-1.5 print:py-1 print:text-[11px]">
                          {appt.net ? (
                            formatAmount(appt.net)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-semibold">
                      <TableCell
                        colSpan={6}
                        className="print:px-1.5 print:py-1 print:text-[11px]"
                      >
                        Totales
                      </TableCell>
                      <TableCell className="text-right tabular-nums print:px-1.5 print:py-1 print:text-[11px]">
                        {formatAmount(selectedStatement.summary.totalBilled)}
                      </TableCell>
                      <TableCell className="text-primary text-right tabular-nums print:px-1.5 print:py-1 print:text-[11px]">
                        {formatAmount(
                          selectedStatement.summary.centerCommission,
                        )}
                      </TableCell>
                      <TableCell className="text-success text-right tabular-nums print:px-1.5 print:py-1 print:text-[11px]">
                        {formatAmount(
                          selectedStatement.summary.professionalNet,
                        )}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
