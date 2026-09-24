import type { getProfessionalAgenda } from "@/lib/dal/appointments";

export type AgendaData = Awaited<ReturnType<typeof getProfessionalAgenda>>;
export type AgendaAppointment = AgendaData["appointments"][number];
export type AgendaWindow = AgendaData["windows"][number];
export type AgendaException = AgendaData["exceptions"][number];
export type AgendaHoliday = AgendaData["holidays"][number];
