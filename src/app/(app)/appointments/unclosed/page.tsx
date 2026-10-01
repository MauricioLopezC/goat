import type { Metadata } from "next";
import Link from "next/link";
import { requirePageRole } from "@/lib/dal/auth";
import { listUnclosedAppointments } from "@/lib/dal/appointments";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/appointment-status";
import { parsePageParam } from "@/lib/pagination";
import { formatDate, formatMinute, toLocalSlot } from "@/lib/schedule";
import { ListPagination } from "@/components/list-pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  StatusChangeDialog,
  type StatusChangeTarget,
} from "../[id]/status-dialog";

export const metadata: Metadata = { title: "Turnos sin cerrar · GOAT" };

// Turnos sin cerrar (HU-22): los Programados que ya terminaron, del más viejo
// al más nuevo, para marcarlos Completado o Vencido sin abrir cada uno. Si
// nadie los cierra, el ausentismo del tablero no los cuenta.
export default async function UnclosedAppointmentsPage({
  searchParams,
}: PageProps<"/appointments/unclosed">) {
  const actor = await requirePageRole("RECEPTIONIST", "MANAGER");
  const { page, closed } = await searchParams;
  const result = await listUnclosedAppointments(parsePageParam(page), actor);
  // Al cerrar uno se vuelve a la misma página, que ya no lo incluye.
  const successHref = (target: StatusChangeTarget) =>
    `/appointments/unclosed?${new URLSearchParams({
      page: String(result.page),
      closed: target,
    })}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg">Turnos sin cerrar</h1>
        <p className="text-muted-foreground">
          Turnos que ya terminaron y siguen Programados. Marcá cada uno como
          Completado si el paciente vino o Vencido si no se presentó: el
          ausentismo solo cuenta los turnos cerrados.
        </p>
      </div>

      {(closed === "COMPLETED" || closed === "EXPIRED") && (
        <Alert className="bg-success-soft text-success-soft-foreground border-success-soft-border">
          <AlertTitle>
            Turno marcado como {APPOINTMENT_STATUS_LABEL[closed].toLowerCase()}
          </AlertTitle>
          <AlertDescription className="text-success-soft-foreground">
            {result.total === 0
              ? "No quedan turnos sin cerrar."
              : `Quedan ${result.total} sin cerrar.`}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4">
          {result.total === 0 ? (
            <p className="text-muted-foreground">
              No hay turnos sin cerrar: todos los turnos pasados están
              Completados, Vencidos o Cancelados.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                {result.total === 1
                  ? "1 turno sin cerrar."
                  : `${result.total} turnos sin cerrar.`}
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Día y horario</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Profesional · Servicio</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((appointment) => {
                    const start = toLocalSlot(appointment.startsAt);
                    const end = toLocalSlot(appointment.endsAt);
                    const when = `${formatDate(start.date)}, ${formatMinute(start.minute)}–${formatMinute(end.minute)}`;
                    const summary = `${appointment.patient.lastName}, ${appointment.patient.firstName} · ${appointment.professional.lastName}, ${appointment.professional.firstName} · ${appointment.service.name} · ${when}`;
                    return (
                      <TableRow key={appointment.id}>
                        <TableCell className="tabular-nums">{when}</TableCell>
                        <TableCell>
                          <Link
                            href={`/appointments/${appointment.id}`}
                            className="font-medium hover:underline"
                          >
                            {appointment.patient.lastName},{" "}
                            {appointment.patient.firstName}
                          </Link>
                          <p className="text-muted-foreground text-xs">
                            {appointment.patient.documentType}{" "}
                            {appointment.patient.documentNumber}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>
                            {appointment.professional.lastName},{" "}
                            {appointment.professional.firstName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {appointment.service.name}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <StatusChangeDialog
                              appointmentId={appointment.id}
                              target="COMPLETED"
                              summary={summary}
                              successHref={successHref("COMPLETED")}
                              triggerClassName="h-8"
                            />
                            {/* Un turno cobrado no se vence: el paciente vino (HU-21). */}
                            {!appointment.hasActivePayment && (
                              <StatusChangeDialog
                                appointmentId={appointment.id}
                                target="EXPIRED"
                                summary={summary}
                                successHref={successHref("EXPIRED")}
                                triggerClassName="h-8"
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ListPagination
                page={result}
                pathname="/appointments/unclosed"
                label="Páginas de turnos sin cerrar"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
