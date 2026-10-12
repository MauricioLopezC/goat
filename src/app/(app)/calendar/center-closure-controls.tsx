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
import { formatDate, formatMinute } from "@/lib/schedule";
import { deleteHoliday } from "../holidays/actions";
import { CloseCenterForm } from "../holidays/close-center-form";

export type CalendarClosure = {
  id: number;
  description: string;
  startDate?: string;
  endDate?: string;
  startMinute?: number | null;
  endMinute?: number | null;
  date?: string;
};

/// Cerrar el centro o quitar el cierre del día que se ve en la vista día del
/// calendario (HU-14, HU-23). Un día pasado no se puede cerrar.
export function CenterClosureControls({
  date,
  holiday,
  canClose,
}: {
  date: string;
  holiday: CalendarClosure | null;
  canClose: boolean;
}) {
  // El diálogo no depende de `holiday`: al cerrar el día la página se
  // revalida y el diálogo sigue abierto para mostrar el mensaje de éxito.
  const [closing, setClosing] = useState(false);

  const sDate = holiday?.startDate || date;
  const eDate = holiday?.endDate || date;
  const periodText =
    sDate === eDate
      ? `El ${formatDate(sDate)}`
      : `Del ${formatDate(sDate)} al ${formatDate(eDate)}`;
  const timeText =
    holiday?.startMinute !== null &&
    holiday?.startMinute !== undefined &&
    holiday?.endMinute !== null &&
    holiday?.endMinute !== undefined
      ? `de ${formatMinute(holiday.startMinute)} a ${formatMinute(holiday.endMinute)} cada día`
      : `todo el día`;
  const isFullDay =
    holiday?.startMinute === null || holiday?.startMinute === undefined;

  const deleteDescription = holiday
    ? `${periodText} (${timeText}) deja de estar cerrado por «${holiday.description}». Se quitará el cierre de todo el período y el centro volverá a ofrecer turnos según las franjas de cada profesional.`
    : "";

  return (
    <>
      {holiday && (
        <ConfirmDelete
          action={deleteHoliday}
          fields={{ id: holiday.id }}
          title="Quitar cierre"
          confirmLabel="Quitar cierre"
          description={deleteDescription}
          trigger={
            <Button type="button" variant="outline">
              <CalendarCheck data-icon="inline-start" />
              Quitar cierre
            </Button>
          }
        />
      )}
      {canClose && (!holiday || !isFullDay) && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setClosing(true)}
        >
          <CalendarOff data-icon="inline-start" />
          Cerrar el centro
        </Button>
      )}
      <Dialog open={closing} onOpenChange={setClosing}>
        {/* La lista de turnos afectados puede ser larga: el diálogo scrollea. */}
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cerrar el centro</DialogTitle>
            <DialogDescription>
              Definí el período y tramo horario en que el centro no brindará
              atención para todos los profesionales.
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
