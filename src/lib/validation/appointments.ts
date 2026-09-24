import { z } from "@/lib/validation/zod";
import { isCalendarDate, TIME_PATTERN } from "@/lib/schedule";

export const appointmentDateSchema = z
  .string()
  .refine(isCalendarDate, "Ingresá una fecha válida.");
export const appointmentOptionsSchema = z.object({
  query: z.string().trim().max(80).default(""),
  patientPage: z.number().int().min(1).max(1000).default(1),
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

export const cancelAppointmentSchema = z.object({
  appointmentId: z.number().int().positive(),
  reason: z.string().trim().min(1, "El motivo es obligatorio.").max(500),
  requestedBy: z
    .string()
    .trim()
    .min(1, "Indicá quién solicitó la cancelación.")
    .max(100),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const professionalAgendaSchema = z.object({
  date: appointmentDateSchema.optional(),
  view: z.enum(["week", "day"]).default("week"),
  hideCancelled: z.boolean().default(false),
  professionalId: z.number().int().positive().optional(),
});
export type ProfessionalAgendaInput = z.input<typeof professionalAgendaSchema>;

