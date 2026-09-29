import Link from "next/link";
import { History } from "lucide-react";
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
  EmptyTitle,
} from "@/components/ui/empty";
import { ListPagination } from "@/components/list-pagination";
import { HistoryFilters } from "./history-filters";

// Historial de turnos del paciente en su ficha (HU-18): asistencia, filtros y
// la cronología paginada, con los próximos separados de los pasados.

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
}: {
  patientId: number;
  history: PatientAppointmentHistory;
  query: HistoryQuery;
  /// El actor es el profesional: ve solo sus turnos y no ve el cobro.
  own: boolean;
  now: Date;
}) {
  const { page, attendance, professionals } = history;
  const { upcoming, past } = splitByTiming(page.items, now);
  const filtered =
    query.status !== undefined || query.professionalId !== undefined;

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
              Historial de turnos
            </CardTitle>
            <CardDescription>
              {own
                ? "Turnos del paciente con vos, del más reciente al más antiguo."
                : "Turnos del paciente, del más reciente al más antiguo."}
            </CardDescription>
          </div>
          <dl
            className="flex gap-2"
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
                  : own
                    ? "El paciente no tiene turnos con vos"
                    : "El paciente todavía no tiene turnos"}
              </EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? "Probá con otro estado o profesional."
                  : "Cuando se le dé un turno, va a aparecer acá."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {upcoming.length > 0 && (
              <HistoryGroup title="Próximos" items={upcoming} own={own} />
            )}
            {past.length > 0 && (
              <HistoryGroup title="Pasados" items={past} own={own} />
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
}: {
  title: string;
  items: HistoryItem[];
  own: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label-md uppercase text-muted-foreground">{title}</h3>
      <ol className="flex flex-col gap-2">
        {items.map((item) => (
          <HistoryEntry key={item.id} item={item} own={own} />
        ))}
      </ol>
    </section>
  );
}

function HistoryEntry({ item, own }: { item: HistoryItem; own: boolean }) {
  const start = toLocalSlot(item.startsAt);
  const end = toLocalSlot(item.endsAt);
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-l-4 border-border bg-card p-3",
        APPOINTMENT_STATUS_BORDER_CLASS[item.status],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="font-medium tabular-nums">
            {formatDate(start.date)} · {formatMinute(start.minute)}–
            {formatMinute(end.minute)}
          </p>
          <p className="text-body-sm text-muted-foreground">
            {item.service.name}
            {!own && <> · {personName(item.professional)}</>}
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
          <Button asChild variant="outline" size="sm">
            <Link href={`/appointments/${item.id}`}>Ver turno</Link>
          </Button>
        </div>
      </div>
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
          Registrado por {personName(item.createdBy)} ·{" "}
          {formatInstant(item.createdAt)}
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
