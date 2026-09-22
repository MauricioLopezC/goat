import Link from "next/link";
import {
  BriefcaseMedical,
  IdCard,
  Plus,
  Stethoscope,
  UserCheck,
  UserX,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/dal/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Profesionales — Goat",
  description: "Gestión y listado de profesionales del centro.",
};

export default async function ProfessionalsPage() {
  await requirePageRole("MANAGER");

  const professionals = await prisma.professional.findMany({
    orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      titles: { select: { id: true, name: true } },
      services: { select: { id: true, name: true, durationMinutes: true } },
    },
  });

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
        <Link href="/professionals/new">
          <Button
            size="lg"
            className="rounded-xl bg-primary hover:bg-primary-hover text-white shadow-sm gap-2"
          >
            <Plus className="size-4 stroke-[2.5]" />
            Nuevo profesional
          </Button>
        </Link>
      </div>

      {professionals.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-border p-12 text-center bg-card">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-0">
            <div className="size-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
              <Stethoscope className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                No hay profesionales registrados
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Comience registrando al primer profesional del centro con su
                matrícula y prestaciones habilitadas.
              </p>
            </div>
            <Link href="/professionals/new">
              <Button className="rounded-xl bg-primary hover:bg-primary-hover text-white">
                <Plus className="size-4 mr-1.5" />
                Registrar profesional
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {professionals.map((prof) => (
            <Card
              key={prof.id}
              className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-shadow overflow-hidden"
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
                        variant="outline"
                        className="text-muted-foreground rounded-lg text-xs font-medium gap-1"
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
                          className="bg-info-soft/60 text-info-soft-foreground border-info-soft-border/50 text-[11px] rounded-lg"
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
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                  >
                    Ver ficha
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
