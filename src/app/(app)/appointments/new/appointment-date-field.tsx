"use client";

import { useEffect, useRef, useState } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isCalendarDate } from "@/lib/schedule";

function toDisplayDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function toIsoDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const date = `${match[3]}-${match[2]}-${match[1]}`;
  return isCalendarDate(date) ? date : null;
}

export function AppointmentDateField({
  date,
  min,
  max,
}: {
  date: string;
  min: string;
  max: string;
}) {
  const [value, setValue] = useState(() => toDisplayDate(date));
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isoDate = toIsoDate(value);
  const valid = isoDate !== null && isoDate >= min && isoDate <= max;
  const error =
    isoDate === null
      ? "Ingresá una fecha válida en formato día/mes/año."
      : `Elegí una fecha entre ${toDisplayDate(min)} y ${toDisplayDate(max)}.`;

  useEffect(() => {
    inputRef.current?.setCustomValidity(valid ? "" : error);
  }, [valid, error]);

  return (
    <Field data-invalid={touched && !valid}>
      <FieldLabel htmlFor="date">Fecha</FieldLabel>
      <Input
        ref={inputRef}
        id="date"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setTouched(true);
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={touched && !valid}
        required
      />
      <input type="hidden" name="date" value={valid ? isoDate : ""} />
      {touched && !valid && <FieldError>{error}</FieldError>}
    </Field>
  );
}
