// Quién pidió cancelar o reprogramar un turno (HU-10, HU-16). Se guarda como
// texto en `AppointmentEvent.requestedBy`, por eso los valores van en español.
export const REQUESTED_BY_OPTIONS = [
  "El paciente",
  "El profesional",
  "El centro",
] as const;
