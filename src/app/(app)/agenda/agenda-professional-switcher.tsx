"use client";

import { useRouter } from "next/navigation";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

export interface ProfessionalSummaryItem {
  id: number;
  firstName: string;
  lastName: string;
}

export function AgendaProfessionalSwitcher({
  currentProfessionalId,
  professionals,
  date,
  view,
  hideCancelled,
}: {
  currentProfessionalId: number;
  professionals: ProfessionalSummaryItem[];
  date: string;
  view: "month" | "week" | "day";
  hideCancelled?: boolean;
}) {
  const router = useRouter();

  return (
    <Field className="w-auto">
      <FieldLabel htmlFor="agenda-professional">Profesional</FieldLabel>
      <NativeSelect
        id="agenda-professional"
        value={currentProfessionalId}
        onChange={(event) => {
          const newId = event.target.value;
          if (!newId) return;
          const params = new URLSearchParams();
          params.set("professionalId", newId);
          params.set("date", date);
          if (view !== "week") params.set("view", view);
          if (hideCancelled) params.set("hideCancelled", "1");
          router.push(`/agenda?${params.toString()}`);
        }}
      >
        {professionals.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.lastName}, {p.firstName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}
