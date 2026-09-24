"use client";

import { useRouter } from "next/navigation";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { calendarHref, type CalendarQuery } from "@/lib/calendar";

// Filtros por profesional y servicio del calendario del centro (HU-11). Al
// cambiar, navegan: el estado vive en la URL.

export function CalendarFilters({
  query,
  professionals,
  services,
}: {
  query: CalendarQuery;
  professionals: {
    id: number;
    firstName: string;
    lastName: string;
    services: { id: number }[];
  }[];
  services: { id: number; name: string }[];
}) {
  const router = useRouter();
  const offersService = (professional: (typeof professionals)[number]) =>
    !query.serviceId ||
    professional.services.some((service) => service.id === query.serviceId);
  const go = (next: CalendarQuery) =>
    router.push(calendarHref(next), { scroll: false });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field className="w-auto">
        <FieldLabel htmlFor="calendar-professional">Profesional</FieldLabel>
        <NativeSelect
          id="calendar-professional"
          value={query.professionalId ?? ""}
          onChange={(event) =>
            go({
              ...query,
              professionalId: Number(event.target.value) || undefined,
            })
          }
        >
          <NativeSelectOption value="">Todos</NativeSelectOption>
          {professionals.filter(offersService).map((professional) => (
            <NativeSelectOption key={professional.id} value={professional.id}>
              {professional.lastName}, {professional.firstName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className="w-auto">
        <FieldLabel htmlFor="calendar-service">Servicio</FieldLabel>
        <NativeSelect
          id="calendar-service"
          value={query.serviceId ?? ""}
          onChange={(event) => {
            const serviceId = Number(event.target.value) || undefined;
            const professional = professionals.find(
              (item) => item.id === query.professionalId,
            );
            // Si el profesional elegido no presta el servicio, se quita.
            const keepProfessional =
              !serviceId ||
              professional?.services.some(
                (service) => service.id === serviceId,
              );
            go({
              ...query,
              serviceId,
              professionalId: keepProfessional
                ? query.professionalId
                : undefined,
            });
          }}
        >
          <NativeSelectOption value="">Todos</NativeSelectOption>
          {services.map((service) => (
            <NativeSelectOption key={service.id} value={service.id}>
              {service.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}
