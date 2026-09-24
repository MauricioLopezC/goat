"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PatientSearchBarProps {
  initialQuery?: string;
}

export function PatientSearchBar({ initialQuery = "" }: PatientSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (term: string) => {
    startTransition(() => {
      const trimmed = term.trim();
      if (trimmed) {
        router.push(`/patients?q=${encodeURIComponent(trimmed)}`);
      } else {
        router.push("/patients");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    handleSearch("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-2 max-w-xl"
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por DNI, apellido o nombre..."
          className="pl-9 pr-9 h-10 text-body-md"
          autoFocus
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
            title="Limpiar búsqueda"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <Button
        type="submit"
        disabled={isPending}
        className="gap-2 h-10 shrink-0"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Buscando...</span>
          </>
        ) : (
          <>
            <Search className="size-4" />
            <span>Buscar</span>
          </>
        )}
      </Button>
    </form>
  );
}
