import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatHours, formatMonthKey, formatRate } from "@/lib/indicators";
import { formatAmount } from "@/lib/payments";
import type { calculateCenterMetrics } from "@/lib/center-metrics";
import { IndicatorCard } from "./indicator-card";

type Metrics = ReturnType<typeof calculateCenterMetrics>;
type ChartRow = { label: string; value: number; display: string };

function countPhrase(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function money(cents: number) {
  return formatAmount((cents / 100).toFixed(2));
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
          <p className="text-muted-foreground">Sin datos en este período.</p>
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

export function CenterMetrics({
  metrics,
  professionalNames,
}: {
  metrics: Metrics;
  professionalNames: Map<number, string>;
}) {
  const leader = metrics.topProfessionals[0];
  const topService = metrics.services[0];
  const topSpecialty = metrics.specialties[0];
  const busiestDay = [...metrics.days].sort((a, b) => b.count - a.count)[0];
  const topPatientCount = metrics.frequentPatients[0];
  const income = metrics.income;
  const topLoad = [...metrics.professionals]
    .filter((item) => item.patientsPerHour !== null)
    .sort((a, b) => (b.patientsPerHour ?? 0) - (a.patientsPerHour ?? 0))[0];
  const topWorked = [...metrics.professionals].sort(
    (a, b) => b.workedMinutes - a.workedMinutes,
  )[0];
  const previousReading =
    income.changeRate === null
      ? "Sin cobros en el período anterior para comparar."
      : income.changeRate === 0
        ? "Los ingresos se mantuvieron frente al período anterior."
        : `Los ingresos ${income.changeRate > 0 ? "subieron" : "bajaron"} ${formatRate(Math.abs(income.changeRate))} frente al período anterior.`;

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="center-metrics-title"
    >
      <div>
        <h2 id="center-metrics-title" className="text-title-md">
          Actividad y demanda
        </h2>
        <p className="text-muted-foreground">
          Qué se atiende, cuándo y cuánto ingresa al centro.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <IndicatorCard
          title="Tasa de cancelación"
          value={formatRate(metrics.cancellationRate)}
          meter={metrics.cancellationRate}
          detail={
            metrics.appointmentCount === 0
              ? "Sin turnos dados en el período."
              : `${countPhrase(metrics.cancelled, "turno cancelado", "turnos cancelados")} de ${metrics.appointmentCount} dados. ${metrics.cancelled > 0 ? "Sirve para evaluar confirmaciones y política de cancelación." : "No hubo cancelaciones."}`
          }
          formula="Turnos Cancelados divididos por todos los turnos dados en el período, incluido el profesional filtrado."
        />
        <IndicatorCard
          title="Ingreso de dinero"
          value={
            income.totalCents === 0 && income.previousTotalCents === 0
              ? "Sin datos"
              : money(income.totalCents)
          }
          detail={
            income.totalCents === 0 && income.previousTotalCents === 0
              ? "No hubo cobros vigentes en el período."
              : previousReading
          }
          formula="Suma de cobros vigentes por fecha de cobro. Se compara con los meses inmediatamente anteriores, de igual duración; excluye anulaciones."
        />
        <IndicatorCard
          title="Pacientes habituales"
          value={
            topPatientCount === undefined
              ? "Sin datos"
              : String(topPatientCount)
          }
          detail={
            topPatientCount === undefined
              ? "No hubo atenciones completadas."
              : `El paciente más frecuente tuvo ${countPhrase(topPatientCount, "atención", "atenciones")}. Puede señalar una serie de tratamiento.`
          }
          formula="Turnos Completados por paciente; el tablero no muestra nombres ni identificadores."
        />
        <IndicatorCard
          title="Pacientes por hora"
          value={
            topLoad?.patientsPerHour === null || topLoad === undefined
              ? "Sin datos"
              : topLoad.patientsPerHour.toLocaleString("es-AR", {
                  maximumFractionDigits: 2,
                })
          }
          detail={
            topLoad
              ? `${professionalNames.get(topLoad.id) ?? "El profesional"} tiene la mayor carga por hora; revisá sus franjas abiertas.`
              : "No hubo turnos Completados para calcularla."
          }
          formula="Pacientes distintos atendidos divididos por las horas de turnos Completados de cada profesional. Se muestra el valor más alto."
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ComparisonCard
          title="Profesionales con más pacientes"
          rows={metrics.topProfessionals.map((item) => ({
            label: professionalNames.get(item.id) ?? `Profesional ${item.id}`,
            value: item.distinctPatients,
            display: countPhrase(
              item.distinctPatients,
              "paciente",
              "pacientes",
            ),
          }))}
          reading={
            leader
              ? `${professionalNames.get(leader.id) ?? "El primer profesional"} atendió a ${countPhrase(leader.distinctPatients, "paciente distinto", "pacientes distintos")}; conviene revisar si necesita más horas.`
              : "Sin atenciones completadas para comparar."
          }
          formula="Cinco profesionales con más pacientes distintos en turnos Completados."
        />
        <ComparisonCard
          title="Pacientes más frecuentes"
          rows={metrics.frequentPatients.map((count, index) => ({
            label: `Paciente ${index + 1}`,
            value: count,
            display: countPhrase(count, "atención", "atenciones"),
          }))}
          reading={
            topPatientCount === undefined
              ? "Sin atenciones completadas para comparar."
              : `La mayor frecuencia es de ${countPhrase(topPatientCount, "atención", "atenciones")}; los nombres no se muestran.`
          }
          formula="Cinco mayores cantidades de turnos Completados por paciente, sin identificar a las personas."
        />
        <ComparisonCard
          title="Servicios más solicitados"
          rows={metrics.services.map((item) => ({
            label: item.name,
            value: item.count,
            display: countPhrase(item.count, "turno", "turnos"),
          }))}
          reading={
            topService
              ? `${topService.name} concentra ${formatRate(topService.count / metrics.appointmentCount)} de los turnos; sirve para ajustar la oferta.`
              : "Sin turnos dados para comparar."
          }
          formula="Cinco servicios con más turnos dados, en cualquier estado."
        />
        <ComparisonCard
          title="Especialidades más solicitadas"
          rows={metrics.specialties.map((item) => ({
            label: item.name,
            value: item.count,
            display: countPhrase(item.count, "turno", "turnos"),
          }))}
          reading={
            topSpecialty
              ? `${topSpecialty.name} encabeza la demanda con ${countPhrase(topSpecialty.count, "turno", "turnos")}.`
              : "Sin turnos con especialidad para comparar."
          }
          formula="Cinco especialidades con más turnos dados; los servicios sin especialidad no se agrupan."
        />
        <ComparisonCard
          title="Días más concurridos"
          rows={metrics.days.map((item) => ({
            label: item.label,
            value: item.count,
            display: countPhrase(item.count, "turno", "turnos"),
          }))}
          reading={
            busiestDay?.count
              ? `${busiestDay.label} es el día con más turnos; puede requerir más personal o agenda.`
              : "Sin turnos dados para comparar."
          }
          formula="Turnos dados por día de la semana de inicio, en cualquier estado."
        />
        <ComparisonCard
          title="Ingresos por mes"
          rows={income.months.map((item) => ({
            label: formatMonthKey(item.month),
            value: item.cents,
            display: money(item.cents),
          }))}
          reading={
            income.totalCents > 0
              ? previousReading
              : income.previousTotalCents > 0
                ? previousReading
                : "Sin cobros vigentes en el período."
          }
          formula="Cobros vigentes agrupados por mes de cobro; excluye anulaciones."
        />
        <ComparisonCard
          title="Ingresos por medio de pago"
          rows={income.methods.map((item) => ({
            label: item.name,
            value: item.cents,
            display: money(item.cents),
          }))}
          reading={
            income.methods.length > 0
              ? `${[...income.methods].sort((a, b) => b.cents - a.cents)[0].name} es el medio que más dinero aportó.`
              : "Sin cobros vigentes en el período."
          }
          formula="Cobros vigentes agrupados por medio de pago."
        />
        <ComparisonCard
          title="Horas trabajadas"
          rows={[...metrics.professionals]
            .filter((item) => item.workedMinutes > 0)
            .sort((a, b) => b.workedMinutes - a.workedMinutes)
            .slice(0, 5)
            .map((item) => ({
              label: professionalNames.get(item.id) ?? `Profesional ${item.id}`,
              value: item.workedMinutes,
              display: formatHours(item.workedMinutes),
            }))}
          reading={
            topWorked?.workedMinutes
              ? `${professionalNames.get(topWorked.id) ?? "El profesional"} sumó ${formatHours(topWorked.workedMinutes)} de atención, la mayor carga del período. Compará este valor con sus franjas abiertas.`
              : "Sin turnos Completados para comparar."
          }
          formula="Suma de la duración de turnos Completados por profesional."
        />
      </div>
    </section>
  );
}
