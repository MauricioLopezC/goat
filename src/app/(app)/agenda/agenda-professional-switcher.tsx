"use client";

import { useRouter } from "next/navigation";
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
  view: "week" | "day";
  hideCancelled?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        Profesional:
      </span>
      <NativeSelect
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
        className="h-8 text-xs font-medium w-auto"
      >
        {professionals.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.lastName}, {p.firstName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
