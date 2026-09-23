import { z } from "@/lib/validation/zod";
import { isCalendarDate, TIME_PATTERN } from "@/lib/schedule";

export const appointmentDateSchema = z
  .string()
  .refine(isCalendarDate, "Ingresá una fecha válida.");
export const appointmentOptionsSchema = z.object({
  query: z.string().trim().max(80).default(""),
  patientId: z.number().int().positive().optional(),
  serviceId: z.number().int().positive().optional(),
});
export const availableSlotsSchema = z.object({
  patientId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  professionalId: z.number().int().positive(),
  date: appointmentDateSchema,
});
export const createAppointmentSchema = availableSlotsSchema.extend({
  startTime: z.string().regex(TIME_PATTERN, "Elegí un horario disponible."),
  notes: z.string().trim().max(500).default(""),
});
export type AvailableSlotsInput = z.infer<typeof availableSlotsSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
