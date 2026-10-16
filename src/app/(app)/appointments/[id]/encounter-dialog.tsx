"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createEncounter, updateEncounter } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionErrorAlert } from "@/components/action-error-alert";
import type { ActionResult } from "@/lib/actions";
import { Stethoscope, Edit3 } from "lucide-react";

export function EncounterDialog({
  appointmentId,
  encounterId,
  initialNotes = "",
  initialIndications = "",
  summary,
  triggerLabel,
  mode = "create",
}: {
  appointmentId: number;
  encounterId?: number;
  initialNotes?: string;
  initialIndications?: string;
  summary: string;
  triggerLabel?: string;
  mode?: "create" | "update";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [indications, setIndications] = useState(initialIndications);

  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: number }> | null,
    FormData
  >(async () => {
    let result: ActionResult<{ id: number }>;
    if (mode === "create") {
      result = await createEncounter({
        appointmentId,
        notes: notes.trim(),
        indications: indications.trim() || undefined,
      });
    } else {
      result = await updateEncounter({
        encounterId: encounterId!,
        notes: notes.trim(),
        indications: indications.trim() || undefined,
      });
    }

    if (result.ok) {
      toast.success(
        mode === "create"
          ? "Evolución registrada correctamente."
          : "Evolución actualizada correctamente.",
      );
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
    return result;
  }, null);

  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isCreate ? "default" : "outline"} size="sm">
          {isCreate ? (
            <Stethoscope className="mr-1.5 size-4" />
          ) : (
            <Edit3 className="mr-1.5 size-4" />
          )}
          {triggerLabel ??
            (isCreate ? "Registrar atención" : "Editar atención")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            {isCreate
              ? "Registrar atención médica"
              : "Modificar atención médica"}
          </DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="encounter-notes" className="font-semibold">
              Notas de la atención (diagnóstico y observaciones) *
            </Label>
            <Textarea
              id="encounter-notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describí los hallazgos clínicos, evolución y observaciones de la consulta..."
              rows={4}
              required
              maxLength={5000}
              className="resize-y"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="encounter-indications" className="font-semibold">
              Indicaciones al paciente (medicación, reposo, estudios)
            </Label>
            <Textarea
              id="encounter-indications"
              name="indications"
              value={indications}
              onChange={(e) => setIndications(e.target.value)}
              placeholder="Indicaciones terapéuticas, estudios complementarios pedidos, recetas o pautas de alarma..."
              rows={3}
              maxLength={5000}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Se conservará en la bitácora médica del paciente.
            </p>
          </div>

          {state && !state.ok && <ActionErrorAlert error={state.error} />}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !notes.trim()}>
              {pending
                ? "Guardando..."
                : isCreate
                  ? "Guardar atención"
                  : "Actualizar atención"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
