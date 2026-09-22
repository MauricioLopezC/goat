import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { getProfessional } from "@/lib/dal/professionals";

export const metadata: Metadata = { title: "Ficha profesional · Goat" };

const weekdays = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

function formatMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export default async function ProfessionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageRole(...STAFF_ROLES);
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();

  const professional = await getProfessional(Number(id), actor);
  if (!professional) notFound();

  const windows = [...professional.availabilityWindows].sort(
    (a, b) =>
      Object.keys(weekdays).indexOf(a.weekday) -
        Object.keys(weekdays).indexOf(b.weekday) ||
      a.startMinute - b.startMinute,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {professional.lastName}, {professional.firstName}
          </h1>
          <p className="text-sm text-muted-foreground">Ficha del profesional</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/professionals">Volver al listado</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del profesional</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            <span className="font-medium">Estado:</span>{" "}
            <Badge
              className={
                professional.active
                  ? "bg-success-soft text-success-soft-foreground border-success-soft-border"
                  : "bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border"
              }
            >
              {professional.active ? "Activo" : "Inactivo"}
            </Badge>
          </p>
          <p>
            <span className="font-medium">Documento:</span>{" "}
            {professional.documentType} {professional.documentNumber}
          </p>
          <p>
            <span className="font-medium">Matrícula:</span>{" "}
            {professional.licenseNumber}
          </p>
          <p>
            <span className="font-medium">Teléfono:</span>{" "}
            {professional.phone || "No informado"}
          </p>
          <p>
            <span className="font-medium">Correo:</span>{" "}
            {professional.email || "No informado"}
          </p>
          <p>
            <span className="font-medium">Foto (URL):</span>{" "}
            {professional.photoUrl || "No informada"}
          </p>
          <p>
            <span className="font-medium">Títulos:</span>{" "}
            {professional.titles.map((title) => title.name).join(", ") ||
              "No informados"}
          </p>
          <p>
            <span className="font-medium">Servicios:</span>{" "}
            {professional.services.map((service) => service.name).join(", ") ||
              "No informados"}
          </p>
          <p>
            <span className="font-medium">Observaciones:</span>{" "}
            {professional.notes || "Sin observaciones"}
          </p>
          <p>
            <span className="font-medium">Registrado:</span>{" "}
            {professional.createdAt.toLocaleString("es-AR")}
          </p>
          <p>
            <span className="font-medium">Última actualización:</span>{" "}
            {professional.updatedAt.toLocaleString("es-AR")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agenda semanal</CardTitle>
        </CardHeader>
        <CardContent>
          {windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este profesional todavía no tiene franjas de atención cargadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {windows.map((window) => (
                <li key={window.id} className="rounded-md border p-3 text-sm">
                  <span className="font-medium">
                    {weekdays[window.weekday]}
                  </span>
                  {": "}
                  {formatMinute(window.startMinute)}–
                  {formatMinute(window.endMinute)}
                  {window.room && ` · ${window.room.name}`}
                  {window.services.length > 0 &&
                    ` · ${window.services.map((service) => service.name).join(", ")}`}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
