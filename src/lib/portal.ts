import { randomInt } from "node:crypto";
import { AppointmentStatus } from "@/generated/prisma/enums";

// Reglas puras del portal del paciente (HU-31). Sin acceso a base de datos:
// las usan la DAL, la UI y las pruebas unitarias.

/// Anticipación mínima de 24 horas para cancelar desde el portal (HU-31).
export const PORTAL_CANCELLATION_ADVANCE_MS = 24 * 60 * 60 * 1000;

/// ¿Faltan al menos 24 horas desde `now` hasta `startsAt`?
export function hasMinimumCancellationNotice(
  startsAt: Date,
  now: Date = new Date(),
): boolean {
  return startsAt.getTime() - now.getTime() >= PORTAL_CANCELLATION_ADVANCE_MS;
}

/// ¿Debe el actor cambiar obligatoriamente su contraseña temporal antes de operar? (HU-31)
export function mustPatientChangePassword(actor?: {
  role?: string;
  mustChangePassword?: boolean;
}): boolean {
  return actor?.role === "PATIENT" && Boolean(actor?.mustChangePassword);
}

/// ¿Puede el paciente cancelar este turno desde el portal en el instante `now`?
/// Exige estado `SCHEDULED`, sin cobro vigente (`PAID`), al menos 24 h de anticipación
/// y que el paciente no tenga pendiente el cambio obligatorio de contraseña (HU-31).
export function canPatientCancelAppointment(
  appointment: {
    status: AppointmentStatus;
    startsAt: Date;
    hasActivePayment: boolean;
  },
  now: Date = new Date(),
  actor?: {
    role?: string;
    mustChangePassword?: boolean;
  },
): boolean {
  if (mustPatientChangePassword(actor)) {
    return false;
  }
  return (
    appointment.status === AppointmentStatus.SCHEDULED &&
    !appointment.hasActivePayment &&
    hasMinimumCancellationNotice(appointment.startsAt, now)
  );
}

// Alfabeto sin caracteres ambiguos (sin 0/O ni 1/l/I) para que el paciente no
// confunda letras y números al transcribir la contraseña temporal.
const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/// Genera una contraseña temporal criptográficamente aleatoria de `length` caracteres.
export function generateTemporaryPassword(length = 10): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password +=
      TEMP_PASSWORD_ALPHABET[randomInt(0, TEMP_PASSWORD_ALPHABET.length)];
  }
  return password;
}
