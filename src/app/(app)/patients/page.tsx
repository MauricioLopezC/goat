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
import { canAccess } from "@/lib/route-access";
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
import { parsePageParam } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { PatientSearchBar } from "./PatientSearchBar";

export const metadata: Metadata = {
  title: "Pacientes · GOAT",
  description: "Listado, búsqueda y gestión de pacientes del centro.",
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
  const canBookAppointment = canAccess("/appointments/new", actor.role);

  // Con menos de 3 caracteres no se filtra: se sigue viendo el listado completo.
  const isFiltering = query.length >= 3;
  const isTooShort = query.length > 0 && query.length < 3;

  const patientsPage = await searchPatients(
    query,
    parsePageParam(resolvedParams?.page),
    actor,
  );
  const patients = patientsPage.items;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-display-lg font-semibold tracking-tight text-foreground">
            Pacientes
          </h1>
          <p className="text-body-lg text-muted-foreground mt-1">
            Listado de pacientes, del registrado más recientemente al más
            antiguo. Buscá por documento, apellido o nombre.
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

      {isTooShort && (
        <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <Search className="size-4" />
          Ingresá al menos 3 caracteres para filtrar. Mientras tanto se muestran
          todos los pacientes.
        </p>
      )}

      {/* Sin pacientes registrados */}
      {!isFiltering && patients.length === 0 && (
        <Card className="rounded-xl border-dashed border-2 border-border p-12 text-center bg-card">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-0">
            <div className="size-12 rounded-lg bg-primary-soft text-primary-soft-foreground flex items-center justify-center">
              <Users className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-title-lg font-semibold text-foreground">
                Todavía no hay pacientes registrados
              </h3>
              <p className="text-body-md text-muted-foreground max-w-md">
                Los pacientes que registres van a aparecer en este listado.
              </p>
            </div>
            {isManagerOrReceptionist && (
              <Button asChild className="gap-2 mt-2">
                <Link href="/patients/new">
                  <UserPlus className="size-4" />
                  Registrar paciente
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Búsqueda sin resultados */}
      {isFiltering && patients.length === 0 && (
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

      {/* Listado, completo o filtrado */}
      {patients.length > 0 && (
        <div className="space-y-4">
          <p className="text-body-sm text-muted-foreground">
            {isFiltering
              ? patientsPage.total === 1
                ? "Se encontró "
                : "Se encontraron "
              : "Hay "}
            <span className="font-semibold text-foreground">
              {patientsPage.total}
            </span>{" "}
            {patientsPage.total === 1 ? "paciente" : "pacientes"}
            {isFiltering
              ? "."
              : patientsPage.total === 1
                ? " registrado."
                : " registrados."}
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

                          {canBookAppointment && (
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
                          )}
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
            params={{ q: isFiltering ? query : undefined }}
            label="Páginas de pacientes"
          />
        </div>
      )}
    </div>
  );
}
