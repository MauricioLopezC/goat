import { z } from "@/lib/validation/zod";
import { AppointmentStatus } from "@/generated/prisma/enums";

// Historial de turnos del paciente (HU-18). Zod valida la forma; el alcance
// del profesional y la existencia del paciente los verifica la DAL.

export const patientAppointmentHistorySchema = z.object({
  patientId: z.number().int().positive(),
  status: z.enum(AppointmentStatus).optional(),
  professionalId: z.number().int().positive().optional(),
  page: z.number().int().min(1).default(1),
});
export type PatientAppointmentHistoryInput = z.input<
  typeof patientAppointmentHistorySchema
>;
