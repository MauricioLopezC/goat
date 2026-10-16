"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { enablePatientAccess, disablePatientAccess } from "./actions";

interface PortalAccessCardProps {
  patientId: number;
  patientActive: boolean;
  patientEmail: string;
  user: {
    id: number;
    email: string;
    active: boolean;
    mustChangePassword: boolean;
    createdAt: Date | string;
  } | null;
}

export function PortalAccessCard({
  patientId,
  patientActive,
  patientEmail,
  user,
}: PortalAccessCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleEnableAccess() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await enablePatientAccess({ patientId });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setCopied(false);
      setCredentialsModal({
        email: result.data.email,
        temporaryPassword: result.data.temporaryPassword,
      });
      toast.success("Credenciales temporales generadas.");
      router.refresh();
    });
  }

  function handleDisableAccess() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await disablePatientAccess({ patientId });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      toast.success("Acceso al portal deshabilitado.");
      router.refresh();
    });
  }

  async function handleCopyPassword() {
    if (!credentialsModal) return;
    try {
      await navigator.clipboard.writeText(credentialsModal.temporaryPassword);
      setCopied(true);
      toast.success("Contraseña copiada al portapapeles.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      toast.error("No se pudo copiar al portapapeles.");
    }
  }

  return (
    <>
      <Card className="rounded-xl border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-title-lg flex items-center gap-2 text-foreground">
              <KeyRound className="size-4 text-primary" />
              Portal del paciente
            </CardTitle>
            {!user ? (
              <Badge
                variant="outline"
                className="rounded-lg text-xs font-medium text-muted-foreground"
              >
                Sin acceso
              </Badge>
            ) : !user.active ? (
              <Badge className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border rounded-lg text-xs font-medium gap-1">
                <ShieldOff className="size-3" />
                Acceso deshabilitado
              </Badge>
            ) : user.mustChangePassword ? (
              <Badge className="bg-info-soft text-info-soft-foreground border-info-soft-border rounded-lg text-xs font-medium gap-1">
                <Lock className="size-3" />
                Activo · Clave temporal
              </Badge>
            ) : (
              <Badge className="bg-success-soft text-success-soft-foreground border-success-soft-border rounded-lg text-xs font-medium gap-1">
                <ShieldCheck className="size-3" />
                Acceso activo
              </Badge>
            )}
          </div>
          <CardDescription>
            Habilitá el ingreso del paciente al portal para consultar sus
            turnos, cancelarlos con anticipación y descargar comprobantes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {errorMessage && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="size-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-label-md text-muted-foreground uppercase">
                Usuario de ingreso (email)
              </p>
              <p className="text-body-md font-medium text-foreground mt-0.5">
                {user?.email ?? patientEmail}
              </p>
            </div>
            <div>
              <p className="text-label-md text-muted-foreground uppercase">
                Estado de la contraseña
              </p>
              <p className="text-body-md text-foreground mt-0.5">
                {!user
                  ? "No generada"
                  : !user.active
                    ? "Cuenta desactivada"
                    : user.mustChangePassword
                      ? "Pendiente de cambio en el primer ingreso"
                      : "Actualizada por el paciente"}
              </p>
            </div>
          </div>

          {!patientActive ? (
            <p className="text-body-sm text-muted-foreground italic">
              El paciente está inactivo. Reactivá su ficha para habilitar el
              acceso al portal.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
              {!user ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleEnableAccess}
                  disabled={isPending}
                  className="gap-2"
                >
                  <KeyRound className="size-4" />
                  Habilitar acceso al portal
                </Button>
              ) : !user.active ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleEnableAccess}
                  disabled={isPending}
                  className="gap-2"
                >
                  <RefreshCw className="size-4" />
                  Reactivar y generar clave temporal
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEnableAccess}
                    disabled={isPending}
                    className="gap-2"
                  >
                    <RefreshCw className="size-4" />
                    Regenerar contraseña temporal
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <ShieldOff className="size-4" />
                        Deshabilitar acceso
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          ¿Deshabilitar el acceso al portal?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          El paciente ya no podrá iniciar sesión en el portal
                          con <strong>{user.email}</strong>. Su ficha y su
                          historial de turnos en el centro se mantienen
                          intactos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={handleDisableAccess}
                        >
                          Deshabilitar acceso
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={credentialsModal !== null}
        onOpenChange={(open) => {
          if (!open) setCredentialsModal(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              Credenciales temporales del portal
            </DialogTitle>
            <DialogDescription>
              Entregá estos datos al paciente. Por seguridad, la contraseña
              temporal se muestra <strong>una sola vez</strong> y el sistema le
              pedirá cambiarla en su primer ingreso.
            </DialogDescription>
          </DialogHeader>

          {credentialsModal && (
            <div className="space-y-3 rounded-xl border border-border bg-tray p-4">
              <div>
                <p className="text-label-sm text-muted-foreground uppercase">
                  Correo electrónico
                </p>
                <p className="text-body-md font-medium text-foreground mt-0.5">
                  {credentialsModal.email}
                </p>
              </div>
              <div>
                <p className="text-label-sm text-muted-foreground uppercase">
                  Contraseña temporal
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <code className="font-mono text-base font-semibold tracking-wider text-foreground select-all">
                    {credentialsModal.temporaryPassword}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPassword}
                    className="gap-1.5 shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-success" />
                        Copiada
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
