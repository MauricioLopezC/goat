import Link from "next/link";
import { AlertTriangle, History, Lock, Stethoscope } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import type {
  HistoryItem,
  PatientAppointmentHistory,
} from "@/lib/dal/patient-history";
import {
  APPOINTMENT_EVENT_LABEL,
  APPOINTMENT_PRIORITY_LABEL,
  APPOINTMENT_STATUS_BADGE_CLASS,
  APPOINTMENT_STATUS_BORDER_CLASS,
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_ROW_CLASS,
} from "@/lib/appointment-status";
import {
  HISTORY_ANCHOR,
  historyParams,
  splitByTiming,
  type HistoryQuery,
} from "@/lib/patient-history";
import {
  formatDate,
  formatInstant,
  formatMinute,
  toLocalSlot,
} from "@/lib/schedule";
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
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListPagination } from "@/components/list-pagination";
import { HistoryFilters } from "./history-filters";

// Bitácora y turnos del paciente en su ficha (HU-18, HU-26): asistencia,
// cancelaciones destacadas, atención médica registrada, filtros y cronología paginada.

type Person = { firstName: string; lastName: string };

const personName = (person: Person) =>
  `${person.lastName}, ${person.firstName}`;

function slotLabel(instant: Date) {
  const slot = toLocalSlot(instant);
  return `${formatDate(slot.date)}, ${formatMinute(slot.minute)}`;
}

export function AppointmentHistory({
  patientId,
  history,
  query,
  own,
  now,
  forbidden = false,
}: {
  patientId: number;
  history: PatientAppointmentHistory | null;
  query: HistoryQuery;
  /// El actor es profesional: ve las notas e indicaciones clínicas.
  own: boolean;
  now: Date;
  forbidden?: boolean;
}) {
  if (forbidden || !history) {
    return (
      <Card
        id={HISTORY_ANCHOR}
        className="scroll-mt-6 rounded-xl border-border bg-card shadow-xs"
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
              <History className="size-4 text-primary" />
              Bitácora del paciente
            </CardTitle>
            <CardDescription>
              Bitácora clínica y turnos del paciente.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-1">
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Lock className="size-4" />
              </EmptyMedia>
              <EmptyTitle>Acceso restringido a la bitácora</EmptyTitle>
              <EmptyDescription>
                Por confidencialidad médica, solo podés acceder a la bitácora de
                pacientes que atendés o atendiste en el centro.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const { page, attendance, professionals } = history;
  const { upcoming, past } = splitByTiming(page.items, now);
  const filtered =
    query.status !== undefined ||
    query.professionalId !== undefined ||
    query.withEncounter === true;

  return (
    <Card
      id={HISTORY_ANCHOR}
      className="scroll-mt-6 rounded-xl border-border bg-card shadow-xs"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
              <History className="size-4 text-primary" />
              Bitácora del paciente
            </CardTitle>
            <CardDescription>
              {own
                ? "Bitácora clínica y turnos del paciente, del más reciente al más antiguo."
                : "Historial de turnos y asistencias del paciente, del más reciente al más antiguo."}
            </CardDescription>
          </div>
          <dl
            className="flex flex-wrap gap-2"
            aria-label="Asistencia del paciente"
            title="Cuenta todos los turnos visibles, sin el filtro de estado."
          >
            <div className="rounded-lg border border-success-soft-border bg-success-soft px-3 py-1.5 text-success-soft-foreground">
              <dt className="text-label-sm uppercase">Completados</dt>
              <dd className="text-title-md font-bold tabular-nums">
                {attendance.completed}
              </dd>
            </div>
            <div className="rounded-lg border border-warning-soft-border bg-warning-soft px-3 py-1.5 text-warning-soft-foreground">
              <dt className="text-label-sm uppercase">Vencidos</dt>
              <dd className="text-title-md font-bold tabular-nums">
                {attendance.expired}
              </dd>
            </div>
            <div className="rounded-lg border border-destructive-soft-border bg-destructive-soft px-3 py-1.5 text-destructive-soft-foreground">
              <dt className="text-label-sm uppercase">Cancelados</dt>
              <dd className="text-title-md font-bold tabular-nums">
                {attendance.cancelled}
              </dd>
            </div>
          </dl>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-1">
        <HistoryFilters
          patientId={patientId}
          query={query}
          professionals={professionals}
        />
        {page.total === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyTitle>
                {filtered
                  ? "No hay turnos con estos filtros"
                  : "El paciente todavía no tiene turnos"}
              </EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? "Probá con otro estado, profesional o quitando el filtro de atención registrada."
                  : "Cuando se le dé un turno, va a aparecer acá."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {upcoming.length > 0 && (
              <HistoryGroup
                title="Próximos"
                items={upcoming}
                own={own}
                isPast={false}
              />
            )}
            {past.length > 0 && (
              <HistoryGroup
                title="Pasados"
                items={past}
                own={own}
                isPast={true}
              />
            )}
            <ListPagination
              page={page}
              pathname={`/patients/${patientId}`}
              params={historyParams(query)}
              label="Páginas del historial de turnos"
              hash={HISTORY_ANCHOR}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryGroup({
  title,
  items,
  own,
  isPast,
}: {
  title: string;
  items: HistoryItem[];
  own: boolean;
  isPast: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label-md uppercase text-muted-foreground">{title}</h3>
      <ol className="flex flex-col gap-2">
        {items.map((item) => (
          <HistoryEntry key={item.id} item={item} own={own} isPast={isPast} />
        ))}
      </ol>
    </section>
  );
}

function HistoryEntry({
  item,
  own,
  isPast,
}: {
  item: HistoryItem;
  own: boolean;
  isPast: boolean;
}) {
  const start = toLocalSlot(item.startsAt);
  const end = toLocalSlot(item.endsAt);
  const cancellationEvent = item.events.find((e) => e.type === "CANCELLED");

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-l-4 border-border p-3 transition-colors",
        APPOINTMENT_STATUS_BORDER_CLASS[item.status],
        APPOINTMENT_STATUS_ROW_CLASS[item.status],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="font-medium tabular-nums">
            {formatDate(start.date)} · {formatMinute(start.minute)}–
            {formatMinute(end.minute)}
          </p>
          <p className="text-body-sm text-muted-foreground">
            {item.service.name} · {personName(item.professional)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.priority === "URGENT" && (
            <Badge
              variant="outline"
              className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border"
            >
              {APPOINTMENT_PRIORITY_LABEL.URGENT}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={APPOINTMENT_STATUS_BADGE_CLASS[item.status]}
          >
            {APPOINTMENT_STATUS_LABEL[item.status]}
          </Badge>
          {item.canViewDetail && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/appointments/${item.id}`}>Ver turno</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Resultado de asistencia para turnos pasados (HU-26) */}
      {isPast && (
        <div className="flex items-center gap-2 text-body-sm">
          <span className="text-muted-foreground">Resultado:</span>
          {item.status === "COMPLETED" && (
            <span className="font-semibold text-success">
              Vino (Completado)
            </span>
          )}
          {item.status === "EXPIRED" && (
            <span className="font-semibold text-warning">Faltó (Vencido)</span>
          )}
          {item.status === "CANCELLED" && (
            <span className="font-semibold text-muted-foreground">
              Canceló (Cancelado)
            </span>
          )}
          {item.status === "SCHEDULED" && (
            <span className="font-semibold text-muted-foreground">
              Programado (sin cierre registrado)
            </span>
          )}
        </div>
      )}

      {/* Cancelación destacada con motivo y quién la pidió (HU-26) */}
      {item.status === "CANCELLED" && (
        <div className="rounded-lg border border-destructive-soft-border bg-destructive-soft/40 p-2.5 text-body-sm text-destructive-soft-foreground">
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Turno cancelado</span>
            {cancellationEvent?.requestedBy && (
              <span className="font-normal text-muted-foreground">
                · Solicitó:{" "}
                <strong className="font-semibold text-foreground">
                  {cancellationEvent.requestedBy}
                </strong>
              </span>
            )}
          </div>
          {cancellationEvent?.reason ? (
            <p className="mt-1 text-foreground">
              <span className="text-muted-foreground">Motivo:</span>{" "}
              {cancellationEvent.reason}
            </p>
          ) : (
            <p className="mt-0.5 text-xs italic text-muted-foreground">
              Sin motivo registrado
            </p>
          )}
        </div>
      )}

      {/* Atención médica registrada (HU-25, HU-26) */}
      {item.encounter && own && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
              <Stethoscope className="size-4 text-primary" />
              <span>Atención médica</span>
              <span className="font-normal text-muted-foreground">
                · {personName(item.encounter.professional)}
              </span>
            </div>
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary-soft text-primary text-xs"
            >
              Atención registrada
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Diagnóstico y observaciones clínicas
            </span>
            <p className="whitespace-pre-wrap break-words text-body-sm text-foreground">
              {item.encounter.notes}
            </p>
          </div>
          {item.encounter.indications ? (
            <div className="flex flex-col gap-1 border-t border-border/50 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Indicaciones al paciente
              </span>
              <p className="whitespace-pre-wrap break-words text-body-sm text-foreground">
                {item.encounter.indications}
              </p>
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Sin indicaciones registradas.
            </p>
          )}
        </div>
      )}

      {/* Para recepción y gerencia: secreto médico protegido (HU-26) */}
      {item.encounter && !own && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-body-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Stethoscope className="size-4 text-primary" />
            <span>
              Atención médica registrada por{" "}
              <strong className="font-medium text-foreground">
                {personName(item.encounter.professional)}
              </strong>
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary-soft text-primary text-xs"
          >
            Atención registrada
          </Badge>
        </div>
      )}

      {item.priority === "URGENT" && item.priorityReason && (
        <p className="text-body-sm">
          <span className="text-muted-foreground">Motivo de urgencia:</span>{" "}
          {item.priorityReason}
        </p>
      )}
      {item.notes && (
        <p className="text-body-sm whitespace-pre-wrap break-words">
          <span className="text-muted-foreground">Observación:</span>{" "}
          {item.notes}
        </p>
      )}
      {item.payment && (
        <p className="text-body-sm">
          <span className="text-muted-foreground">Cobrado:</span>{" "}
          <span className="font-mono font-medium tabular-nums">
            ${" "}
            {Number(item.payment.amount).toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>{" "}
          · {item.payment.paymentMethod} · {personName(item.payment.createdBy)}{" "}
          · {formatInstant(item.payment.createdAt)}
        </p>
      )}
      <ul className="flex flex-col gap-1 border-t border-border pt-2 text-body-sm text-muted-foreground">
        <li>
          Registrado por {personName(item.createdBy)}
          {item.createdBy.role === Role.PATIENT &&
            " (Portal del paciente)"} · {formatInstant(item.createdAt)}
        </li>
        {item.events.map((event) => (
          <li key={event.id}>
            <span className="font-medium text-foreground">
              {APPOINTMENT_EVENT_LABEL[event.type]}
            </span>{" "}
            por {personName(event.user)} · {formatInstant(event.createdAt)}
            {eventDetail(event) && <> · {eventDetail(event)}</>}
            {event.reason && <> · Motivo: {event.reason}</>}
            {event.requestedBy && <> · Solicitó: {event.requestedBy}</>}
          </li>
        ))}
      </ul>
    </li>
  );
}

/// Qué cambió en una reprogramación o un cambio de prioridad.
function eventDetail(event: HistoryItem["events"][number]) {
  if (
    event.type === "RESCHEDULED" &&
    event.previousStartsAt &&
    event.newStartsAt
  ) {
    const professionalChange =
      event.previousProfessional &&
      event.newProfessional &&
      event.previousProfessional.id !== event.newProfessional.id
        ? ` (${personName(event.previousProfessional)} → ${personName(event.newProfessional)})`
        : "";
    return `${slotLabel(event.previousStartsAt)} → ${slotLabel(event.newStartsAt)}${professionalChange}`;
  }
  if (
    event.type === "PRIORITY_CHANGED" &&
    event.previousPriority &&
    event.newPriority
  )
    return `${APPOINTMENT_PRIORITY_LABEL[event.previousPriority]} → ${APPOINTMENT_PRIORITY_LABEL[event.newPriority]}`;
  return null;
}
