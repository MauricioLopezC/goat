"use client";

import { useId, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  filterServices,
  groupServicesBySpecialty,
  type ServiceOption,
} from "@/lib/services";
import { cn } from "cn";

export interface ServiceComboboxProps {
  services: ServiceOption[];
  value?: number | null;
  onChange: (serviceId: number | undefined) => void;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  className?: string;
  showDuration?: boolean;
}

export function ServiceCombobox({
  services,
  value,
  onChange,
  placeholder = "Buscar o elegir servicio...",
  allowAll = false,
  allLabel = "Todos los servicios",
  disabled = false,
  id,
  name,
  required = false,
  className,
  showDuration = true,
}: ServiceComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const selectedService = useMemo(
    () => services.find((s) => s.id === value) ?? null,
    [services, value],
  );

  const displayLabel = useMemo(() => {
    if (allowAll && (value === 0 || value === undefined || value === null)) {
      return allLabel;
    }
    return selectedService?.name ?? "";
  }, [allowAll, value, allLabel, selectedService]);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(displayLabel);
  const [prevDisplayLabel, setPrevDisplayLabel] = useState(displayLabel);

  if (prevDisplayLabel !== displayLabel) {
    setPrevDisplayLabel(displayLabel);
    setInputValue(displayLabel);
  }

  const isActivelyFiltering =
    open && query.trim() !== "" && query.trim() !== displayLabel;

  const filteredServices = useMemo(() => {
    if (!isActivelyFiltering) return services;
    return filterServices(services, query);
  }, [services, isActivelyFiltering, query]);

  const groupedServices = useMemo(() => {
    return groupServicesBySpecialty(services);
  }, [services]);
  const hasNoResults = isActivelyFiltering
    ? filteredServices.length === 0
    : services.length === 0;

  const handleValueChange = (val: number | null) => {
    if (val === null || val === undefined || (allowAll && val === 0)) {
      onChange(undefined);
      setQuery("");
      setInputValue(allowAll ? allLabel : "");
    } else {
      onChange(val);
      const chosen = services.find((s) => s.id === val);
      const label = chosen?.name ?? "";
      setQuery("");
      setInputValue(label);
    }
  };

  const handleInputValueChange = (text: string) => {
    setInputValue(text);
    setQuery(text);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setInputValue(displayLabel);
    }
  };

  return (
    <Combobox<number>
      value={allowAll && !value ? 0 : (value ?? null)}
      onValueChange={handleValueChange}
      inputValue={inputValue}
      onInputValueChange={handleInputValueChange}
      open={open}
      onOpenChange={handleOpenChange}
      itemToStringLabel={(val: number | null) => {
        if (allowAll && val === 0) return allLabel;
        return services.find((s) => s.id === val)?.name ?? "";
      }}
      disabled={disabled}
      name={name}
      required={required}
    >
      <ComboboxInput
        id={inputId}
        placeholder={placeholder}
        className={cn("w-full", className)}
        showClear={Boolean(value)}
      />
      <ComboboxContent className="w-[var(--anchor-width)] min-w-[280px] p-0">
        <ComboboxList className="max-h-72 p-1">
          {allowAll && !isActivelyFiltering && (
            <ComboboxItem value={0} className="py-2">
              <span className="font-medium text-foreground">{allLabel}</span>
            </ComboboxItem>
          )}

          {isActivelyFiltering
            ? filteredServices.length > 0
              ? filteredServices.map((service) => (
                  <ServiceComboboxItem
                    key={service.id}
                    service={service}
                    showDuration={showDuration}
                  />
                ))
              : null
            : groupedServices.map((group) => (
                <ComboboxGroup key={group.specialtyName}>
                  <ComboboxLabel className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    {group.specialtyName}
                  </ComboboxLabel>
                  {group.services.map((service) => (
                    <ServiceComboboxItem
                      key={service.id}
                      service={service}
                      showDuration={showDuration}
                    />
                  ))}
                </ComboboxGroup>
              ))}

          {hasNoResults && (
            <div
              role="status"
              aria-live="polite"
              className="py-6 text-center text-sm text-muted-foreground"
            >
              No se encontraron servicios que coincidan con la búsqueda.
            </div>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function ServiceComboboxItem({
  service,
  showDuration,
}: {
  service: ServiceOption;
  showDuration: boolean;
}) {
  return (
    <ComboboxItem
      value={service.id}
      className="flex flex-col items-start gap-0.5 py-2"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="font-medium text-foreground">{service.name}</span>
        {showDuration && (
          <span className="text-code-sm text-muted-foreground tabular-nums">
            {service.durationMinutes} min
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {service.specialty?.name ?? "Sin especialidad"}
      </span>
    </ComboboxItem>
  );
}
