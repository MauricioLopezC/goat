import type { Metadata } from "next";
import Link from "next/link";
import {
  BriefcaseMedical,
  IdCard,
  Plus,
  Stethoscope,
  UserCheck,
  UserX,
} from "lucide-react";

import { requirePageRole } from "@/lib/dal/auth";
import {
  listActiveServices,
  listProfessionalsPage,
} from "@/lib/dal/professionals";
import { emptyPage, parsePageParam } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfessionalFilters } from "./professional-filters";

export const metadata: Metadata = {
  title: "Profesionales · Goat",
  description: "Gestión y listado de profesionales del centro.",
};

type SearchParams = Promise<{
  q?: string | string[];
  serviceId?: string | string[];
  status?: string | string[];
  page?: string | string[];
}>;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // HU-04: un profesional no ve el listado; llega a su ficha desde "Mis
  // horarios".
  const actor = await requirePageRole("MANAGER", "RECEPTIONIST");
  const params = await searchParams;
  const query = single(params.q).trim();
  const serviceValue = single(params.serviceId);
  const serviceId = /^[1-9]\d*$/.test(serviceValue)
    ? Number(serviceValue)
    : undefined;
  const statusValue = single(params.status);
  const status =
    statusValue === "active" || statusValue === "inactive"
      ? statusValue
      : "all";
  const tooShort = query.length === 1;
  const [professionalsPage, services] = await Promise.all([
    tooShort
      ? Promise.resolve(emptyPage<never>())
      : listProfessionalsPage(
          { query, serviceId, status },
          parsePageParam(params.page),
          actor,
        ),
    listActiveServices(actor),
  ]);
  const professionals = professionalsPage.items;

  const isManager = actor.role === "MANAGER";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Profesionales
          </h1>
          <p className="text-sm text-muted-foreground">
            Cuerpo médico, kinesiólogos y especialistas habilitados para
            atención en el centro.
          </p>
        </div>
        {isManager && (
          <Button asChild size="default" className="gap-2">
            <Link href="/professionals/new">
              <Plus className="size-4" />
              Nuevo profesional
            </Link>
          </Button>
        )}
      </div>

      <ProfessionalFilters
        query={query}
        serviceId={serviceValue || "all"}
        status={status}
        services={services}
      />

      {tooShort ? (
        <p className="text-sm text-muted-foreground">
          Ingresá al menos 2 caracteres para buscar. No se realizó la consulta.
        </p>
      ) : professionals.length === 0 ? (
        <Card className="rounded-xl border-dashed border-2 border-border p-12 text-center bg-card">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-0">
            <div className="size-12 rounded-lg bg-primary-soft text-primary-soft-foreground flex items-center justify-center">
              <Stethoscope className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                No se encontraron profesionales
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Probá con otros criterios o limpiá los filtros.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/professionals">Limpiar filtros</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {professionals.map((prof) => (
            <Card
              key={prof.id}
              className="rounded-xl border-border bg-card shadow-xs hover:shadow-md transition-shadow overflow-hidden"
            >
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg font-bold text-foreground">
                      {prof.lastName}, {prof.firstName}
                    </h2>
                    {prof.active ? (
                      <Badge className="bg-success-soft text-success-soft-foreground border-success-soft-border rounded-lg text-xs font-medium gap-1">
                        <UserCheck className="size-3" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border rounded-lg text-xs font-medium gap-1"
                      >
                        <UserX className="size-3" />
                        Inactivo
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground font-mono bg-tray px-2 py-0.5 rounded-lg border border-border">
                      {prof.documentType}: {prof.documentNumber}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-mono">
                      <IdCard className="size-4 text-primary" />
                      <span className="font-semibold text-foreground">
                        M.P. {prof.licenseNumber}
                      </span>
                    </div>
                    {prof.email && <span>{prof.email}</span>}
                    {prof.phone && <span>{prof.phone}</span>}
                  </div>

                  {/* Títulos */}
                  {prof.titles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {prof.titles.map((t) => (
                        <Badge
                          key={t.id}
                          variant="secondary"
                          className="bg-info-soft text-info-soft-foreground border-info-soft-border text-[11px] rounded-lg"
                        >
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Servicios */}
                  {prof.services.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <BriefcaseMedical className="size-3 text-success" />
                        Servicios:
                      </span>
                      {prof.services.map((s) => (
                        <span
                          key={s.id}
                          className="text-xs bg-tray text-foreground px-2 py-0.5 rounded-md border border-border"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Link href={`/professionals/${prof.id}`}>Ver ficha</Link>
                  </Button>
                  {isManager && (
                    <Button asChild size="sm" className="text-xs">
                      <Link href={`/professionals/${prof.id}/edit`}>
                        Modificar
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          <ListPagination
            page={professionalsPage}
            pathname="/professionals"
            params={{
              q: query || undefined,
              serviceId: serviceId ? String(serviceId) : undefined,
              status,
            }}
            label="Páginas de profesionales"
          />
        </div>
      )}
    </div>
  );
}
