import { addDays, toLocalSlot } from "@/lib/schedule";
import { appointmentInstant } from "@/lib/appointment-slots";

/// Devuelve el instante límite para editar la atención de un turno
/// (fin del día siguiente al turno en hora local de Argentina).
export function encounterEditDeadline(appointmentStartsAt: Date): Date {
  const localDate = toLocalSlot(appointmentStartsAt).date;
  const dayAfterNext = addDays(localDate, 2);
  // 00:00:00 de dos días después es el fin estricto del día siguiente
  return appointmentInstant(dayAfterNext, 0);
}

/// Indica si el plazo para editar la atención médica aún está vigente.
export function isEncounterEditable(
  appointmentStartsAt: Date,
  now = new Date(),
): boolean {
  return now.getTime() < encounterEditDeadline(appointmentStartsAt).getTime();
}
