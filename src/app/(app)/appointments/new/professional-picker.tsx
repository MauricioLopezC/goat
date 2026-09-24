"use client";

import { useRouter } from "next/navigation";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

export function ProfessionalPicker({
  patientId,
  serviceId,
  professionalId,
  professionals,
}: {
  patientId: number;
  serviceId: number;
  professionalId?: number;
  professionals: { id: number; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  return (
    <Field>
      <FieldLabel htmlFor="professional">Profesional</FieldLabel>
      <NativeSelect
        id="professional"
        value={professionalId ?? ""}
        onChange={(event) => {
          const params = new URLSearchParams({
            patientId: String(patientId),
            serviceId: String(serviceId),
          });
          if (event.target.value)
            params.set("professionalId", event.target.value);
          router.push(`/appointments/new?${params.toString()}`, {
            scroll: false,
          });
        }}
        className="w-full"
      >
        <NativeSelectOption value="">Elegí un profesional</NativeSelectOption>
        {professionals.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.lastName}, {item.firstName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}
