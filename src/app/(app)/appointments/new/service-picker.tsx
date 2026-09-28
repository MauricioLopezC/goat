"use client";

import { useRouter } from "next/navigation";
import { ServiceCombobox } from "@/components/service-combobox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import type { ServiceOption } from "@/lib/services";

export function ServicePicker({
  patientId,
  selectedServiceId,
  services,
  preset,
}: {
  patientId: number;
  selectedServiceId?: number;
  services: ServiceOption[];
  preset: Record<string, string>;
}) {
  const router = useRouter();

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const handleServiceChange = (serviceId: number | undefined) => {
    const params = new URLSearchParams();
    params.set("patientId", String(patientId));

    for (const [key, value] of Object.entries(preset)) {
      if (key !== "serviceId" && value) {
        params.set(key, value);
      }
    }

    if (serviceId) {
      params.set("serviceId", String(serviceId));
    }

    router.push(`/appointments/new?${params.toString()}`, {
      scroll: false,
    });
  };

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="service-picker">Servicio</FieldLabel>
        <ServiceCombobox
          id="service-picker"
          services={services}
          value={selectedServiceId ?? null}
          onChange={handleServiceChange}
          placeholder="Buscar por nombre o especialidad..."
        />
        {selectedService && (
          <FieldDescription>
            Duración:{" "}
            <strong className="font-medium text-foreground tabular-nums">
              {selectedService.durationMinutes} min
            </strong>
            {selectedService.specialty && (
              <span> · Especialidad: {selectedService.specialty.name}</span>
            )}
          </FieldDescription>
        )}
      </Field>
    </FieldGroup>
  );
}
