import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarPlus,
  Edit,
  Eye,
  Plus,
  Search,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { searchPatients } from "@/lib/dal/patients";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calculateAge } from "@/lib/patients";
import { emptyPage, parsePageParam } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { PatientSearchBar } from "./PatientSearchBar";

export const metadata: Metadata = {
  title: "Pacientes · Goat",
  description: "Búsqueda y gestión de pacientes del centro.",
};

interface PatientsPageProps {
  searchParams?: Promise<{ q?: string; page?: string }>;
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default async function PatientsPage({
  searchParams,
}: PatientsPageProps) {
  const actor = await requirePageRole(...STAFF_ROLES);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rawQuery = resolvedParams?.q ?? "";
  const query = rawQuery.trim();

  const isManagerOrReceptionist =
    actor.role === "RECEPTIONIST" || actor.role === "MANAGER";

  const hasMinChars = query.length >= 3;
  const isTooShort = query.length > 0 && query.length < 3;

  const patientsPage = hasMinChars
    ? await searchPatients(query, parsePageParam(resolvedParams?.page), actor)
    : emptyPage<never>();
  const patients = patientsPage.items;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-display-lg font-semibold tracking-tight text-foreground">
            Pacientes
          </h1>
          <p className="text-body-lg text-muted-foreground mt-1">
            Búsqueda por documento, apellido o nombre y gestión de ficha.
          </p>
        </div>
        {isManagerOrReceptionist && (
          <Button asChild size="default" className="gap-2 shrink-0">
            <Link href="/patients/new">
              <Plus className="size-4" />
              Nuevo paciente
            </Link>
          </Button>
        )}
      </div>

      <PatientSearchBar initialQuery={rawQuery} />

      {/* Caso 1: Búsqueda con menos de 3 caracteres */}
      {isTooShort && (
        <Card className="rounded-xl border-dashed border-2 border-border p-8 text-center bg-card">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-0">
            <div className="size-10 rounded-lg bg-info-soft text-info-soft-foreground flex items-center justify-center">
              <Search className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-title-md font-semibold text-foreground">
                Ingresá al menos 3 caracteres
              </h3>
              <p className="text-body-sm text-muted-foreground max-w-md">
                Escribí un apellido, nombre o número de documento con al menos 3
                caracteres para buscar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caso 2: Sin búsqueda iniciada */}
      {!query && (
        <Card className="rounded-xl border-dashed border-2 border-border p-12 text-center bg-card">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-0">
            <div className="size-12 rounded-lg bg-primary-soft text-primary-soft-foreground flex items-center justify-center">
              <Users className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-title-lg font-semibold text-foreground">
                Búsqueda de pacientes
              </h3>
              <p className="text-body-md text-muted-foreground max-w-md">
                Ingresá el número de documento o parte del apellido o nombre del
                paciente en el cuadro de búsqueda para ver sus datos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caso 3: Búsqueda ejecutada sin resultados */}
      {hasMinChars && patients.length === 0 && (
        <Card className="rounded-xl border-dashed border-2 border-border p-10 text-center bg-card">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-0">
            <div className="size-12 rounded-lg bg-warning-soft text-warning-soft-foreground flex items-center justify-center">
              <User className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-title-lg font-semibold text-foreground">
                No se encontraron pacientes para &ldquo;{query}&rdquo;
              </h3>
              <p className="text-body-md text-muted-foreground max-w-md">
                No hay ningún paciente registrado con ese documento, apellido o
                nombre. Podés darlo de alta ahora mismo con estos datos.
              </p>
            </div>
            {isManagerOrReceptionist && (
              <Button asChild className="gap-2 mt-2">
                <Link href={`/patients/new?q=${encodeURIComponent(query)}`}>
                  <UserPlus className="size-4" />
                  Registrar paciente nuevo
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Caso 4: Resultados encontrados */}
      {hasMinChars && patients.length > 0 && (
        <div className="space-y-4">
          <p className="text-body-sm text-muted-foreground">
            Se {patientsPage.total === 1 ? "encontró" : "encontraron"}{" "}
            <span className="font-semibold text-foreground">
              {patientsPage.total}
            </span>{" "}
            {patientsPage.total === 1 ? "paciente" : "pacientes"}.
          </p>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[28%] font-semibold">
                    Paciente
                  </TableHead>
                  <TableHead className="w-[18%] font-semibold">
                    Documento
                  </TableHead>
                  <TableHead className="w-[18%] font-semibold">
                    Nacimiento
                  </TableHead>
                  <TableHead className="w-[16%] font-semibold">
                    Teléfono
                  </TableHead>
                  <TableHead className="w-[20%] font-semibold">
                    Cobertura
                  </TableHead>
                  <TableHead className="w-[200px] text-right font-semibold">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => {
                  const age = calculateAge(patient.birthDate);
                  return (
                    <TableRow key={patient.id} className="hover:bg-tray/50">
                      <TableCell className="font-medium text-foreground py-3">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="hover:text-primary hover:underline font-semibold block"
                        >
                          {patient.lastName}, {patient.firstName}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-code-sm text-foreground py-3">
                        <span className="text-muted-foreground mr-1 text-xs">
                          {patient.documentType}
                        </span>
                        {patient.documentNumber}
                      </TableCell>
                      <TableCell className="text-body-sm text-foreground tabular-nums py-3">
                        {formatDate(patient.birthDate)}{" "}
                        <span className="text-muted-foreground text-xs">
                          ({age} {age === 1 ? "año" : "años"})
                        </span>
                      </TableCell>
                      <TableCell className="text-body-sm text-foreground py-3">
                        {patient.phone}
                      </TableCell>
                      <TableCell className="py-3">
                        {patient.coverageType === "HEALTH_INSURANCE" &&
                        patient.coverage ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-body-sm font-medium text-foreground">
                              {
                                patient.coverage.insurancePlan.healthInsurer
                                  .name
                              }
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {patient.coverage.insurancePlan.name} · Af.{" "}
                              {patient.coverage.memberNumber}
                            </span>
                          </div>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-tray text-foreground border-border text-xs rounded-lg font-normal"
                          >
                            Particular
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                          >
                            <Link href={`/patients/${patient.id}`}>
                              <Eye className="size-3.5" />
                              Ficha
                            </Link>
                          </Button>

                          {isManagerOrReceptionist && (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1"
                            >
                              <Link href={`/patients/${patient.id}/edit`}>
                                <Edit className="size-3.5" />
                                Editar
                              </Link>
                            </Button>
                          )}

                          <Button
                            asChild
                            variant="default"
                            size="sm"
                            className="h-8 text-xs gap-1"
                          >
                            <Link
                              href={`/appointments/new?patientId=${patient.id}`}
                            >
                              <CalendarPlus className="size-3.5" />
                              Turno
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ListPagination
            page={patientsPage}
            pathname="/patients"
            params={{ q: query }}
            label="Páginas de pacientes"
          />
        </div>
      )}
    </div>
  );
}
