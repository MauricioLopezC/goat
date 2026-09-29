import { AppointmentStatus } from "@/generated/prisma/enums";
import { parsePageParam } from "@/lib/pagination";

// Historial de turnos del paciente (HU-18): lo que la ficha calcula sin ir a
// la base. Los filtros viajan en la URL de la ficha, junto a `?page=`.

export type HistoryQuery = {
  status?: AppointmentStatus;
  professionalId?: number;
  page: number;
};

/// Ancla de la sección en la ficha: los links que llevan al historial y los
/// de sus filtros y páginas vuelven a ella.
export const HISTORY_ANCHOR = "historial";

export function patientHistoryHref(patientId: number) {
  return `/patients/${patientId}#${HISTORY_ANCHOR}`;
}

type SearchParams = Record<string, string | string[] | undefined>;

/// Lee los filtros de la URL. Un valor inválido se ignora, como en el resto
/// de los listados: la pantalla muestra todo en vez de fallar.
export function parseHistoryQuery(params: SearchParams): HistoryQuery {
  const status = params.status;
  const professionalId = params.professionalId;
  return {
    status:
      typeof status === "string" &&
      Object.values(AppointmentStatus).includes(status as AppointmentStatus)
        ? (status as AppointmentStatus)
        : undefined,
    professionalId:
      typeof professionalId === "string" &&
      /^[1-9]\d{0,8}$/.test(professionalId)
        ? Number(professionalId)
        : undefined,
    page: parsePageParam(params.page),
  };
}

/// Filtros vigentes como parámetros de URL, para conservarlos al paginar.
export function historyParams(query: HistoryQuery) {
  return {
    status: query.status,
    professionalId: query.professionalId?.toString(),
  };
}

/// Un turno es próximo si está Programado y todavía no empezó. Un Programado
/// cuya hora ya pasó (sin cerrar) va con los pasados.
export function isUpcoming(
  appointment: { status: AppointmentStatus; startsAt: Date },
  now: Date,
) {
  return (
    appointment.status === AppointmentStatus.SCHEDULED &&
    appointment.startsAt > now
  );
}

/// Separa una página del historial en próximos y pasados, conservando el
/// orden (del más reciente al más antiguo) dentro de cada grupo.
export function splitByTiming<
  T extends { status: AppointmentStatus; startsAt: Date },
>(items: T[], now: Date) {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const item of items)
    (isUpcoming(item, now) ? upcoming : past).push(item);
  return { upcoming, past };
}
