"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfessionalFiltersProps {
  query: string;
  serviceId: string;
  status: "active" | "inactive" | "all";
  services: { id: number; name: string }[];
}

function filtersUrl(
  query: string,
  serviceId: string,
  status: "active" | "inactive" | "all",
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (serviceId !== "all") params.set("serviceId", serviceId);
  params.set("status", status);
  return `/professionals?${params.toString()}`;
}

export function ProfessionalFilters({
  query: initialQuery,
  serviceId: initialServiceId,
  status: initialStatus,
  services,
}: ProfessionalFiltersProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    setQuery(initialQuery);
  }

  useEffect(() => {
    if (query === initialQuery) return;

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(filtersUrl(query, initialServiceId, initialStatus), {
          scroll: false,
        });
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, initialQuery, initialServiceId, initialStatus, router]);

  useEffect(() => {
    function syncQueryFromHistory() {
      setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    }

    window.addEventListener("popstate", syncQueryFromHistory);
    return () => window.removeEventListener("popstate", syncQueryFromHistory);
  }, []);

  function applyFilters(next: {
    query?: string;
    serviceId?: string;
    status?: "active" | "inactive" | "all";
  }) {
    startTransition(() => {
      router.replace(
        filtersUrl(
          next.query ?? query,
          next.serviceId ?? initialServiceId,
          next.status ?? initialStatus,
        ),
        { scroll: false },
      );
    });
  }

  return (
    <Card>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({ query });
          }}
        >
          <div className="flex min-w-56 flex-1 flex-col gap-2">
            <Label htmlFor="professional-query">Buscar profesional</Label>
            <Input
              id="professional-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Apellido, nombre, documento o matrícula"
              aria-describedby="professional-query-help"
            />
            <span
              id="professional-query-help"
              className="sr-only"
              aria-live="polite"
            >
              {query.trim().length === 1
                ? "Ingresá al menos 2 caracteres para buscar."
                : "La búsqueda se actualiza automáticamente."}
            </span>
          </div>
          <div className="flex min-w-44 flex-col gap-2">
            <Label htmlFor="professional-service">Servicio</Label>
            <Select
              value={initialServiceId}
              onValueChange={(value) => applyFilters({ serviceId: value })}
              disabled={isPending}
            >
              <SelectTrigger id="professional-service" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todos</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={String(service.id)}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-36 flex-col gap-2">
            <Label htmlFor="professional-status">Estado</Label>
            <Select
              value={initialStatus}
              onValueChange={(value: "active" | "inactive" | "all") =>
                applyFilters({ status: value })
              }
              disabled={isPending}
            >
              <SelectTrigger id="professional-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button asChild variant="outline">
            <Link href="/professionals" onClick={() => setQuery("")}>
              Limpiar
            </Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
