"use client";

import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
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

// Filtros de la bitácora de turnos (HU-18, HU-26). Al cambiar, navegan: el estado
// vive en la URL de la ficha y cambiar un filtro vuelve a la página 1.

export function HistoryFilters({
  patientId,
  query,
  professionals,
}: {
  patientId: number;
  query: HistoryQuery;
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
      <div className="flex items-center gap-2 pb-2">
        <Checkbox
          id="history-with-encounter"
          checked={query.withEncounter === true}
          onCheckedChange={(checked) =>
            go({
              ...query,
              withEncounter: checked === true ? true : undefined,
            })
          }
        />
        <Label
          htmlFor="history-with-encounter"
          className="cursor-pointer text-sm font-medium select-none"
        >
          Solo con atención registrada
        </Label>
      </div>
    </div>
  );
}
