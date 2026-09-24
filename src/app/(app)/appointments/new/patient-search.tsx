"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function PatientSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [previousQuery, setPreviousQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  if (initialQuery !== previousQuery) {
    setPreviousQuery(initialQuery);
    setQuery(initialQuery);
  }

  useEffect(() => {
    if (query === initialQuery) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query);
      startTransition(() => {
        router.replace(`/appointments/new?${params.toString()}`, {
          scroll: false,
        });
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, initialQuery, router]);

  useEffect(() => {
    function syncQueryFromHistory() {
      setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    }

    window.addEventListener("popstate", syncQueryFromHistory);
    return () => window.removeEventListener("popstate", syncQueryFromHistory);
  }, []);

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="patient-search">Buscar paciente</FieldLabel>
        <Input
          id="patient-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={80}
          aria-busy={isPending}
        />
      </Field>
    </FieldGroup>
  );
}
