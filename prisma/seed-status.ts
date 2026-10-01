// Estado de los turnos del seed según la hora de la corrida. Sin Prisma, para
// poder probarlo sin base (`tests/seed-appointments.test.ts`).

import { AppointmentStatus } from "../src/generated/prisma/enums";
import type { SeedAppointment } from "./seed-data";

type StatusInput = Pick<SeedAppointment, "week" | "status" | "pastStatus">;

/// Si el turno toma su estado de la hora de la corrida: los Programados de la
/// semana actual, que según el día en que se corra el seed ya pasaron o no.
function dependsOnRun(a: StatusInput) {
  return a.week === 0 && a.status === AppointmentStatus.SCHEDULED;
}

/// Estado que toma el turno una vez que terminó. Sirve para validar los datos
/// sin depender del día de la corrida.
export function statusOncePast(a: StatusInput): AppointmentStatus {
  return dependsOnRun(a)
    ? (a.pastStatus ?? AppointmentStatus.COMPLETED)
    : a.status;
}

/// Estado con que se siembra el turno: el de una vez terminado si ya terminó
/// al momento de la corrida; si no, el declarado. Un turno en curso sigue
/// Programado.
export function resolveSeedStatus(
  a: StatusInput,
  endsAt: Date,
  now: Date,
): AppointmentStatus {
  return dependsOnRun(a) && endsAt <= now ? statusOncePast(a) : a.status;
}
