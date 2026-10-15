"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelMyAppointment } from "./actions";

interface CancelMyAppointmentDialogProps {
  appointmentId: number;
  dateLabel: string;
  timeLabel: string;
  professionalName: string;
  serviceName: string;
}

export function CancelMyAppointmentDialog({
  appointmentId,
  dateLabel,
  timeLabel,
  professionalName,
  serviceName,
}: CancelMyAppointmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError("Ingresá el motivo de la cancelación.");
      return;
    }

    startTransition(async () => {
      const result = await cancelMyAppointment({
        appointmentId,
        reason: reason.trim(),
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <CalendarX2 className="size-4" />
          Cancelar turno
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar cancelación del turno</DialogTitle>
          <DialogDescription>
            Estás por cancelar tu turno. Al confirmar, el horario se liberará en
            la agenda del profesional.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-tray p-3.5 text-body-sm space-y-1">
          <p className="font-semibold text-foreground">{serviceName}</p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Fecha y hora:</span>{" "}
            {dateLabel} a las {timeLabel} hs
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Profesional:</span>{" "}
            {professionalName}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`cancel-reason-${appointmentId}`}>
              Motivo de cancelación
            </Label>
            <Textarea
              id={`cancel-reason-${appointmentId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: No voy a poder asistir en ese horario..."
              rows={3}
              maxLength={500}
              required
              aria-invalid={Boolean(error)}
            />
            {error && <p className="text-body-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Volver
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
