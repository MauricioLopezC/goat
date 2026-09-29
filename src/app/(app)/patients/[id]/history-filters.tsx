"use client";

import { useRouter } from "next/navigation";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { AppointmentStatus } from "@/generated/prisma/enums";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/appointment-status";
import { pageHref } from "@/lib/pagination";
import {
  HISTORY_ANCHOR,
  historyParams,
  type HistoryQuery,
} from "@/lib/patient-history";

// Filtros del historial de turnos (HU-18). Al cambiar, navegan: el estado
// vive en la URL de la ficha y cambiar un filtro vuelve a la página 1.

export function HistoryFilters({
  patientId,
  query,
  professionals,
}: {
  patientId: number;
  query: HistoryQuery;
  /// Vacío para el profesional, que no filtra por profesional.
  professionals: { id: number; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  const go = (next: HistoryQuery) =>
    router.push(
      `${pageHref(`/patients/${patientId}`, historyParams(next), 1)}#${HISTORY_ANCHOR}`,
      { scroll: false },
    );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field className="w-auto">
        <FieldLabel htmlFor="history-status">Estado</FieldLabel>
        <NativeSelect
          id="history-status"
          value={query.status ?? ""}
          onChange={(event) =>
            go({
              ...query,
              status: (event.target.value || undefined) as
                AppointmentStatus | undefined,
            })
          }
        >
          <NativeSelectOption value="">Todos</NativeSelectOption>
          {Object.values(AppointmentStatus).map((status) => (
            <NativeSelectOption key={status} value={status}>
              {APPOINTMENT_STATUS_LABEL[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {professionals.length > 0 && (
        <Field className="w-auto">
          <FieldLabel htmlFor="history-professional">Profesional</FieldLabel>
          <NativeSelect
            id="history-professional"
            value={query.professionalId ?? ""}
            onChange={(event) =>
              go({
                ...query,
                professionalId: Number(event.target.value) || undefined,
              })
            }
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {professionals.map((professional) => (
              <NativeSelectOption key={professional.id} value={professional.id}>
                {professional.lastName}, {professional.firstName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      )}
    </div>
  );
}
