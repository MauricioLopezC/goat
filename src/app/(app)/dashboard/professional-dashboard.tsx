import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import {
  formatMonthKey,
  formatPeriod,
  formatRate,
  shiftMonthKey,
  type IndicatorPeriod,
} from "@/lib/indicators";
import type { ProfessionalMetrics } from "@/lib/professional-metrics";
import { IndicatorCard } from "./indicator-card";

type ChartRow = { label: string; value: number; display: string };

function countPhrase(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ComparisonCard({
  title,
  rows,
  reading,
  formula,
}: {
  title: string;
  rows: ChartRow[];
  reading: string;
  formula: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{reading}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {max === 0 ? (
          <p className="text-muted-foreground text-sm">
            Sin datos en este período.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{row.label}</span>
                <strong className="shrink-0 tabular-nums">{row.display}</strong>
              </div>
              <Progress
                value={Math.round((row.value / max) * 100)}
                aria-label={`${row.label}: ${row.display}`}
                className="bg-border h-2"
              />
            </div>
          ))
        )}
        <p className="text-muted-foreground mt-auto text-xs">{formula}</p>
      </CardContent>
    </Card>
  );
}

export function ProfessionalDashboard({
  professional,
  period,
  metrics,
  periodError,
  fallbackPeriod,
}: {
  professional: { id: number; firstName: string; lastName: string };
  period: IndicatorPeriod;
  metrics: ProfessionalMetrics;
  periodError: string | null;
  fallbackPeriod: IndicatorPeriod;
}) {
  // Selector de meses: los dos últimos años y los dos meses próximos
  const month = fallbackPeriod.from;
  const months = Array.from({ length: 27 }, (_, index) =>
    shiftMonthKey(month, 2 - index),
  );

  const topService = metrics.services[0];
  const serviceReading =
    metrics.services.length === 0
      ? "Sin turnos registrados en este período."
      : `${topService.serviceName} concentra la mayor demanda (${formatRate(topService.percentage)}).`;

  const newPatientsReading =
    metrics.distinctPatientsCount === 0
      ? "Sin pacientes atendidos en el período."
      : metrics.newPatientsCount > 0
        ? `${metrics.newPatientsCount} de ${countPhrase(metrics.distinctPatientsCount, "paciente", "pacientes")} tuvieron su primera atención médica con vos en el centro.`
        : "Todos los pacientes atendidos en el período ya se habían atendido previamente con vos.";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg">Mi tablero</h1>
        <p className="text-muted-foreground first-letter:uppercase">
          {formatPeriod(period)} · {professional.lastName},{" "}
          {professional.firstName}
        </p>
      </div>

      <form
        key={`${period.from}-${period.to}`}
        action="/dashboard"
        className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3"
      >
        <Field className="w-auto">
          <FieldLabel htmlFor="pro-dashboard-from">Desde</FieldLabel>
          <NativeSelect
            id="pro-dashboard-from"
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
          <FieldLabel htmlFor="pro-dashboard-to">Hasta</FieldLabel>
          <NativeSelect
            id="pro-dashboard-to"
            name="to"
            defaultValue={period.to}
          >
            {months.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {formatMonthKey(option)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit">Aplicar</Button>
      </form>

      {periodError && (
        <Alert variant="destructive">
          <AlertTitle>Período inválido</AlertTitle>
          <AlertDescription>
            {periodError} Mostrando el mes en curso.
          </AlertDescription>
        </Alert>
      )}

      {/* Sección 1: Turnos y Asistencia */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-title-md">Turnos y asistencia</h2>
          <p className="text-muted-foreground">
            Volumen de turnos y cumplimiento de las citas programadas.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <IndicatorCard
            title="Turnos totales"
            value={
              metrics.totalAppointments === 0
                ? "Sin datos"
                : `${metrics.totalAppointments}`
            }
            detail={
              metrics.totalAppointments === 0
                ? "Sin turnos registrados en este período."
                : `${metrics.completedAppointments} completados, ${metrics.expiredAppointments} vencidos y ${metrics.cancelledAppointments} cancelados.`
            }
            formula="Todos los turnos agendados en el período para este profesional."
          />
          <IndicatorCard
            title="Completados"
            value={formatRate(metrics.completedRate)}
            meter={metrics.completedRate}
            detail={
              metrics.totalAppointments === 0
                ? "Sin turnos dados en el período."
                : `${countPhrase(metrics.completedAppointments, "turno atendido", "turnos atendidos")} de ${metrics.totalAppointments} dados.`
            }
            formula="Turnos Completados sobre el total de turnos dados en el período."
          />
          <IndicatorCard
            title="Vencidos"
            value={formatRate(metrics.expiredRate)}
            meter={metrics.expiredRate}
            detail={
              metrics.totalAppointments === 0
                ? "Sin turnos dados en el período."
                : `${countPhrase(metrics.expiredAppointments, "turno sin asistencia", "turnos sin asistencia")} de ${metrics.totalAppointments} dados.`
            }
            formula="Turnos Vencidos (paciente ausente) sobre el total de turnos dados en el período."
          />
          <IndicatorCard
            title="Cancelados"
            value={formatRate(metrics.cancelledRate)}
            meter={metrics.cancelledRate}
            detail={
              metrics.totalAppointments === 0
                ? "Sin turnos dados en el período."
                : `${countPhrase(metrics.cancelledAppointments, "turno cancelado", "turnos cancelados")} de ${metrics.totalAppointments} dados.`
            }
            formula="Turnos Cancelados sobre el total de turnos dados en el período."
          />
        </div>
      </section>

      {/* Sección 2: Pacientes Atendidos */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-title-md">Pacientes</h2>
          <p className="text-muted-foreground">
            Cantidad de pacientes asistidos y captación de nuevos pacientes.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <IndicatorCard
            title="Pacientes atendidos"
            value={
              metrics.distinctPatientsCount === 0
                ? "Sin datos"
                : `${metrics.distinctPatientsCount}`
            }
            detail={
              metrics.distinctPatientsCount === 0
                ? "No hubo pacientes con turnos completados en el período."
                : `${countPhrase(metrics.distinctPatientsCount, "paciente distinto atendido", "pacientes distintos atendidos")} en el período.`
            }
            formula="Pacientes únicos con al menos un turno en estado Completado."
          />
          <IndicatorCard
            title="Pacientes nuevos"
            value={
              metrics.distinctPatientsCount === 0
                ? "Sin datos"
                : formatRate(metrics.newPatientsRate)
            }
            meter={metrics.newPatientsRate}
            detail={newPatientsReading}
            formula="Pacientes con su primera atención médica completada contigo en este período."
          />
        </div>
      </section>

      {/* Sección 3: Servicios y Distribución de Pacientes */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-title-md">Distribución y prestaciones</h2>
          <p className="text-muted-foreground">
            Servicios más requeridos y perfil demográfico de los pacientes
            atendidos.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <ComparisonCard
            title="Turnos por servicio"
            reading={serviceReading}
            rows={metrics.services.map((service) => ({
              label: service.serviceName,
              value: service.count,
              display: `${service.count} (${formatRate(service.percentage)})`,
            }))}
            formula="Cantidad de turnos y porcentaje sobre el total de turnos dados."
          />
          <ComparisonCard
            title="Pacientes por sexo"
            reading={
              metrics.distinctPatientsCount === 0
                ? "Sin datos en este período."
                : "Distribución según sexo registrado en la ficha del paciente."
            }
            rows={metrics.genderDistribution.map((item) => ({
              label: item.label,
              value: item.count,
              display: `${item.count} (${formatRate(item.percentage)})`,
            }))}
            formula="Porcentaje de pacientes atendidos sobre el total de pacientes asistidos."
          />
          <ComparisonCard
            title="Pacientes por edad"
            reading={
              metrics.distinctPatientsCount === 0
                ? "Sin datos en este período."
                : "Edad calculada a la fecha de la atención médica."
            }
            rows={metrics.ageDistribution.map((item) => ({
              label: item.label,
              value: item.count,
              display: `${item.count} (${formatRate(item.percentage)})`,
            }))}
            formula="Distribución por rango etario sobre el total de pacientes atendidos."
          />
        </div>
      </section>
    </div>
  );
}
