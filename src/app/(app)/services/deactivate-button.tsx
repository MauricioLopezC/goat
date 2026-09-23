"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, PowerOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { deactivateServiceAction, activateServiceAction } from "./actions";

interface ServiceStatusButtonProps {
  serviceId: number;
  serviceName: string;
}

function SubmitDeactivateButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className="text-destructive hover:bg-destructive-soft hover:text-destructive-soft-foreground"
    >
      <PowerOff className="size-3.5 mr-1" />
      {pending ? "Desactivando…" : "Desactivar"}
    </Button>
  );
}

export function DeactivateServiceButton({
  serviceId,
  serviceName,
}: ServiceStatusButtonProps) {
  const [state, formAction] = useActionState(deactivateServiceAction, null);

  const error = state && !state.ok ? state.error : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !confirm(
              `¿Estás seguro de que deseas desactivar el servicio "${serviceName}"? No aparecerá más como opción para nuevos turnos.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={serviceId} />
        <SubmitDeactivateButton />
      </form>
      {error && (
        <Alert variant="destructive" className="py-1 px-2 text-xs">
          <AlertCircle className="size-3 mr-1" />
          <AlertDescription className="text-xs">
            {error.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function SubmitActivateButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className="text-success hover:bg-success-soft hover:text-success-soft-foreground"
    >
      <RotateCcw className="size-3.5 mr-1" />
      {pending ? "Reactivando…" : "Reactivar"}
    </Button>
  );
}

export function ActivateServiceButton({
  serviceId,
  serviceName,
}: ServiceStatusButtonProps) {
  const [state, formAction] = useActionState(activateServiceAction, null);

  const error = state && !state.ok ? state.error : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !confirm(
              `¿Deseas reactivar el servicio "${serviceName}"? Volverá a estar disponible para turnos y profesionales.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={serviceId} />
        <SubmitActivateButton />
      </form>
      {error && (
        <Alert variant="destructive" className="py-1 px-2 text-xs">
          <AlertCircle className="size-3 mr-1" />
          <AlertDescription className="text-xs">
            {error.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

