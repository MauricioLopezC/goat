"use client";

import { useState } from "react";
import { CalendarCheck, CalendarOff } from "lucide-react";

import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/schedule";
import { deleteHoliday } from "../holidays/actions";
import { CloseCenterForm } from "../holidays/close-center-form";

/// Cerrar el centro o quitar el cierre del día que se ve en la vista día del
/// calendario (HU-14). Un día pasado no se puede cerrar.
export function CenterClosureControls({
  date,
  holiday,
  canClose,
}: {
  date: string;
  holiday: { id: number; description: string } | null;
  canClose: boolean;
}) {
  // El diálogo no depende de `holiday`: al cerrar el día la página se
  // revalida y el diálogo sigue abierto para mostrar el mensaje de éxito.
  const [closing, setClosing] = useState(false);

  return (
    <>
      {holiday ? (
        <ConfirmDelete
          action={deleteHoliday}
          fields={{ id: holiday.id }}
          title="Quitar cierre"
          confirmLabel="Quitar cierre"
          description={`El ${formatDate(date)} deja de estar cerrado por «${holiday.description}» y el centro vuelve a ofrecer turnos según las franjas de cada profesional.`}
          trigger={
            <Button type="button" variant="outline">
              <CalendarCheck data-icon="inline-start" />
              Quitar cierre
            </Button>
          }
        />
      ) : (
        canClose && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setClosing(true)}
          >
            <CalendarOff data-icon="inline-start" />
            Cerrar el centro este día
          </Button>
        )
      )}
      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar el centro</DialogTitle>
            <DialogDescription>
              El <span className="font-medium">{formatDate(date)}</span>, todo
              el día, para todos los profesionales.
            </DialogDescription>
          </DialogHeader>
          {/* El contenido se desmonta al cerrar: reabrir no muestra el intento
              anterior. */}
          <CloseCenterForm date={date} />
        </DialogContent>
      </Dialog>
    </>
  );
}
