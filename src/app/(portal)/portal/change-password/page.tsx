import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldAlert } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/dal/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Cambiar contraseña · Portal del Paciente · GOAT",
};

export default async function PortalChangePasswordPage() {
  const actor = await requirePageRole(Role.PATIENT);
  const mustChange = Boolean(actor.mustChangePassword);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-4">
      {!mustChange && (
        <div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <Link href="/portal">
              <ArrowLeft className="size-4" />
              Volver a Mis turnos
            </Link>
          </Button>
        </div>
      )}

      {mustChange && (
        <div className="flex items-start gap-3 rounded-xl border border-info-soft-border bg-info-soft p-4 text-info-soft-foreground">
          <ShieldAlert className="size-5 shrink-0 mt-0.5" />
          <div className="text-body-sm">
            <p className="font-semibold">Primer ingreso al portal</p>
            <p className="mt-0.5">
              Ingresaste con una contraseña temporal provista por el centro. Por
              seguridad, elegí una nueva contraseña personal antes de continuar.
            </p>
          </div>
        </div>
      )}

      <Card className="rounded-xl border-border bg-card shadow-xs">
        <CardHeader>
          <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
            <KeyRound className="size-4 text-primary" />
            {mustChange ? "Elegí tu nueva contraseña" : "Cambiar contraseña"}
          </CardTitle>
          <CardDescription>
            {mustChange
              ? "Ingresá la clave temporal que te dieron en recepción y definí tu nueva contraseña."
              : "Actualizá tu contraseña de ingreso al portal del paciente."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm mustChangePassword={mustChange} />
        </CardContent>
      </Card>
    </div>
  );
}
