import { z } from "@/lib/validation/zod";

export const createEncounterSchema = z.object({
  appointmentId: z.number().int().positive(),
  notes: z
    .string()
    .trim()
    .min(1, "Las notas de la atención son obligatorias.")
    .max(5000, "Las notas no pueden superar los 5000 caracteres."),
  indications: z
    .string()
    .trim()
    .max(5000, "Las indicaciones no pueden superar los 5000 caracteres.")
    .nullish()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export type CreateEncounterInput = z.input<typeof createEncounterSchema>;
export type CreateEncounterOutput = z.infer<typeof createEncounterSchema>;

export const updateEncounterSchema = z.object({
  encounterId: z.number().int().positive(),
  notes: z
    .string()
    .trim()
    .min(1, "Las notas de la atención son obligatorias.")
    .max(5000, "Las notas no pueden superar los 5000 caracteres."),
  indications: z
    .string()
    .trim()
    .max(5000, "Las indicaciones no pueden superar los 5000 caracteres.")
    .nullish()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export type UpdateEncounterInput = z.input<typeof updateEncounterSchema>;
export type UpdateEncounterOutput = z.infer<typeof updateEncounterSchema>;
