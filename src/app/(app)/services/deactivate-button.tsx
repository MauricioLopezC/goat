"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { deactivateServiceAction } from "./actions";

interface DeactivateServiceButtonProps {
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
}: DeactivateServiceButtonProps) {
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
