"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { ActionErrorAlert } from "@/components/action-error-alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions";

type DeleteState = ActionResult<{ id: number }> | null;

type DeleteAction = (
  previous: DeleteState,
  formData: FormData,
) => Promise<DeleteState>;

/// Borrado con confirmación (HU-05). El diálogo queda abierto mientras la
/// acción corre y muestra el error si falla; se cierra solo al terminar bien.
export function ConfirmDelete({
  action,
  fields,
  title,
  description,
  trigger,
  onDeleted,
}: {
  action: DeleteAction;
  /// Campos ocultos que identifican lo que se borra.
  fields: Record<string, string | number>;
  title: string;
  description: ReactNode;
  /// Botón que abre la confirmación. Por defecto, "Eliminar".
  trigger?: ReactNode;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Trash2 data-icon="inline-start" />
            Eliminar
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        {/* El contenido se desmonta al cerrar: reabrir no muestra el error
            del intento anterior. */}
        <DeleteForm
          action={action}
          fields={fields}
          title={title}
          description={description}
          onDeleted={() => {
            setOpen(false);
            onDeleted?.();
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteForm({
  action,
  fields,
  title,
  description,
  onDeleted,
}: {
  action: DeleteAction;
  fields: Record<string, string | number>;
  title: string;
  description: ReactNode;
  onDeleted: () => void;
}) {
  const [state, formAction, pending] = useActionState<DeleteState, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result?.ok) onDeleted();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <ActionErrorAlert error={state?.ok === false ? state.error : undefined} />
      <AlertDialogFooter>
        <AlertDialogCancel type="button">Volver</AlertDialogCancel>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Eliminando…" : "Eliminar"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
