import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { DomainError } from "@/lib/actions";
import { requirePageRole } from "@/lib/dal/auth";
import { getCenterIndicators } from "@/lib/dal/indicators";
import {
  currentPeriod,
  formatHours,
  formatMonthKey,
  formatPeriod,
  formatRate,
  shiftMonthKey,
  type IndicatorPeriod,
} from "@/lib/indicators";
import { centerIndicatorsSchema } from "@/lib/validation/indicators";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IndicatorCard } from "./indicator-card";

export const metadata: Metadata = { title: "Tablero · GOAT" };

function single(value: string | string[] | undefined) {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function dashboardHref(period: IndicatorPeriod, professionalId?: number) {
  const search = new URLSearchParams({ from: period.from, to: period.to });
  if (professionalId) search.set("professional", String(professionalId));
  return `/dashboard?${search}`;
}

// Tablero del gerente (HU-22): ocupación, ausentismo, cancelaciones y turnos
// sin cerrar del período, del centro y por profesional. El período y el
// filtro viven en la URL; el formulario es un GET sin JavaScript.
export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const actor = await requirePageRole("MANAGER");
  const params = await searchParams;
  const fallback = currentPeriod();
  const from = single(params.from) ?? fallback.from;
  const professionalParam = single(params.professional);
  const requested = {
    from,
    to: single(params.to) ?? from,
    professionalId:
      professionalParam && /^\d{1,9}$/.test(professionalParam)
        ? Number(professionalParam)
        : undefined,
  };

  // Un período inválido en la URL avisa y muestra el mes en curso.
  const parsed = centerIndicatorsSchema.safeParse(requested);
  const periodError = parsed.success
    ? null
    : (parsed.error.issues[0]?.message ?? "Revisá el período elegido.");
  let input = parsed.success
    ? parsed.data
    : { ...fallback, professionalId: requested.professionalId };
  let data: Awaited<ReturnType<typeof getCenterIndicators>>;
  try {
    data = await getCenterIndicators(input, actor);
  } catch (error) {
    // Un profesional que no existe se ignora: se ve todo el centro.
    if (!(error instanceof DomainError && error.code === "NOT_FOUND"))
      throw error;
    input = { ...input, professionalId: undefined };
    data = await getCenterIndicators(input, actor);
  }
  const { period, center, professionals, professionalOptions } = data;
  const selected = professionalOptions.find(
    (professional) => professional.id === input.professionalId,
  );

  // Meses para elegir: el último año y los dos próximos.
  const month = fallback.from;
  const months = Array.from({ length: 15 }, (_, index) =>
    shiftMonthKey(month, 2 - index),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg">Tablero</h1>
        <p className="text-muted-foreground first-letter:uppercase">
          {formatPeriod(period)}
          {selected
            ? ` · ${selected.lastName}, ${selected.firstName}`
            : " · todo el centro"}
        </p>
      </div>

      {/* La `key` vuelve a montar los selectores al cambiar el filtro sin
          recargar (por ejemplo, desde un link de la tabla). */}
      <form
        key={`${period.from}-${period.to}-${selected?.id ?? ""}`}
        action="/dashboard"
        className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3"
      >
        <Field className="w-auto">
          <FieldLabel htmlFor="dashboard-from">Desde</FieldLabel>
          <NativeSelect
            id="dashboard-from"
            name="from"
            defaultValue={period.from}
          >
            {months.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {formatMonthKey(option)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field className="w-auto">
          <FieldLabel htmlFor="dashboard-to">Hasta</FieldLabel>
          <NativeSelect id="dashboard-to" name="to" defaultValue={period.to}>
            {months.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {formatMonthKey(option)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field className="w-auto">
          <FieldLabel htmlFor="dashboard-professional">Profesional</FieldLabel>
          <NativeSelect
            id="dashboard-professional"
            name="professional"
            defaultValue={selected ? String(selected.id) : ""}
          >
            <NativeSelectOption value="">Todo el centro</NativeSelectOption>
            {professionalOptions.map((professional) => (
              <NativeSelectOption
                key={professional.id}
                value={String(professional.id)}
              >
                {professional.lastName}, {professional.firstName}
                {professional.active ? "" : " (de baja)"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit">Ver indicadores</Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Mes en curso</Link>
        </Button>
        <p className="text-muted-foreground basis-full text-xs">
          Un mes o un rango de hasta tres meses.
        </p>
      </form>

      {periodError && (
        <Alert className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border">
          <AlertTitle>No se pudo usar el período elegido</AlertTitle>
          <AlertDescription className="text-warning-soft-foreground">
            {periodError} Se muestra el mes en curso.
          </AlertDescription>
        </Alert>
      )}

      {center.unclosed > 0 && (
        <Alert className="bg-scheduled-soft text-scheduled-soft-foreground border-scheduled-soft-border">
          <CalendarClock />
          <AlertTitle>
            {center.unclosed === 1
              ? "1 turno del período sigue sin cerrar"
              : `${center.unclosed} turnos del período siguen sin cerrar`}
          </AlertTitle>
          <AlertDescription className="text-scheduled-soft-foreground">
            <p>
              El ausentismo no los cuenta hasta que se marquen Completados o
              Vencidos.{" "}
              <Link
                href="/appointments/unclosed"
                className="font-medium underline"
              >
                Cerrar turnos pendientes
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <IndicatorCard
          title="Ocupación"
          value={formatRate(center.occupancyRate)}
          meter={center.occupancyRate}
          detail={`${formatHours(center.occupiedMinutes)} ocupadas de ${formatHours(center.availableMinutes)} disponibles`}
          formula="Minutos de turnos Programados y Completados dentro de la franja, sobre los minutos de franja disponibles, sin feriados ni ausencias."
        />
        <IndicatorCard
          title="Ausentismo"
          value={formatRate(center.absenteeismRate)}
          meter={center.absenteeismRate}
          detail={
            center.absenteeismRate === null
              ? "No hay turnos cerrados en el período"
              : `${center.expired} vencidos de ${center.completed + center.expired} turnos cerrados`
          }
          formula="Turnos Vencidos sobre turnos Completados más Vencidos."
        />
        <IndicatorCard
          title="Cancelaciones"
          value={String(center.cancelled)}
          detail={
            center.cancelled === 1 ? "turno cancelado" : "turnos cancelados"
          }
          formula="Turnos Cancelados que estaban dados para el período."
        />
        <IndicatorCard
          title="Turnos sin cerrar"
          value={String(center.unclosed)}
          detail="Programados que ya terminaron"
          formula="Turnos Programados cuya hora de fin ya pasó. No cuentan para el ausentismo."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por profesional</CardTitle>
        </CardHeader>
        <CardContent>
          {professionals.length === 0 ? (
            <p className="text-muted-foreground">
              Ningún profesional tiene franjas ni turnos en el período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Profesional</TableHead>
                  <TableHead className="text-right">Ocupación</TableHead>
                  <TableHead className="text-right">Horas ocupadas</TableHead>
                  <TableHead className="text-right">Completados</TableHead>
                  <TableHead className="text-right">Vencidos</TableHead>
                  <TableHead className="text-right">Ausentismo</TableHead>
                  <TableHead className="text-right">Cancelados</TableHead>
                  <TableHead className="text-right">Sin cerrar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {professionals.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={dashboardHref(period, row.id)}
                        className="font-medium hover:underline"
                      >
                        {row.lastName}, {row.firstName}
                      </Link>
                      {!row.active && (
                        <Badge
                          variant="outline"
                          className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border ml-2"
                        >
                          De baja
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatRate(row.occupancyRate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {formatHours(row.occupiedMinutes)} de{" "}
                      {formatHours(row.availableMinutes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.completed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.expired}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatRate(row.absenteeismRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.cancelled}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.unclosed}
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
