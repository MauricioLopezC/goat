import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/dal/auth";
import { getPortalBookingOptions } from "@/lib/dal/appointments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { PortalBookingForm } from "./portal-booking-form";

export const metadata: Metadata = {
  title: "Sacar turno · Portal del Paciente · GOAT",
};

export default async function NewPortalAppointmentPage() {
  const actor = await requirePageRole(Role.PATIENT);
  if (actor.mustChangePassword) {
    redirect("/portal/change-password");
  }

  const options = await getPortalBookingOptions(actor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Link href="/portal">
            <ArrowLeft className="size-4" />
            Volver a mis turnos
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-display-lg font-bold tracking-tight text-foreground">
          Sacar un turno
        </h1>
        <p className="text-body-md text-muted-foreground">
          Elegí la prestación que necesitás y seleccioná el primer horario libre
          o el profesional y día de tu preferencia.
        </p>
      </div>

      {!options.canBook ? (
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardContent className="py-12">
            <Empty className="border-0 bg-transparent">
              <EmptyHeader>
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
                  <ShieldAlert className="size-6" />
                </div>
                <EmptyTitle>Límite de turnos futuros alcanzado</EmptyTitle>
                <EmptyDescription className="max-w-md text-balance text-body-sm text-muted-foreground">
                  Ya contás con {options.futureAppointmentsCount} turnos futuros
                  programados desde el portal. Para evitar reservas que no se
                  utilicen, el portal permite hasta dos turnos futuros por
                  paciente. Podés esperar a que se cumplan tus turnos actuales o
                  comunicarte con el centro para gestionar reservas adicionales.
                </EmptyDescription>
              </EmptyHeader>
              <div className="mt-6 flex justify-center">
                <Button asChild variant="outline">
                  <Link href="/portal">Ver mis turnos programados</Link>
                </Button>
              </div>
            </Empty>
          </CardContent>
        </Card>
      ) : options.services.length === 0 ? (
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardContent className="py-12">
            <Empty className="border-0 bg-transparent">
              <EmptyHeader>
                <EmptyTitle>
                  No hay servicios disponibles actualmente
                </EmptyTitle>
                <EmptyDescription className="max-w-md text-balance text-body-sm text-muted-foreground">
                  En este momento no hay prestaciones ambulatorias disponibles
                  para reserva directa desde el portal. Por favor, comunicate
                  telefónicamente o acercate a la recepción.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <PortalBookingForm options={options} />
      )}
    </div>
  );
}
