import { z } from "@/lib/validation/zod";

/**
 * Validador para crear un nuevo servicio (HU-06).
 *
 * Reglas de negocio:
 * - Nombre obligatorio, entre 1 y 120 caracteres.
 * - Duración en minutos: positiva y múltiplo del bloque del centro (30 min).
 * - Requiere orden médica: booleano.
 * - Descripción: opcional (hasta 500 caracteres).
 * - Especialidad / área: opcional (entero positivo).
 */
export const createServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del servicio es obligatorio")
    .max(120, "El nombre no puede superar los 120 caracteres"),

  durationMinutes: z.coerce
    .number()
    .int("La duración debe ser un número entero")
    .positive("La duración debe ser mayor a 0")
    .refine(
      (val) => val % 30 === 0,
      "La duración debe ser múltiplo de 30 minutos (bloque de grilla)",
    )
    .default(30),

  requiresReferral: z.preprocess((val) => {
    if (typeof val === "boolean") return val;
    if (val === "on" || val === "true" || val === "1") return true;
    return false;
  }, z.boolean()),

  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede superar los 500 caracteres")
    .nullish()
    .transform((v) => (v ? v : null)),

  specialtyId: z.coerce
    .number()
    .int()
    .positive()
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Validador para actualizar un servicio existente (HU-06).
 */
export const updateServiceSchema = createServiceSchema.extend({
  id: z.coerce
    .number()
    .int()
    .positive("El identificador del servicio es inválido"),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/**
 * Validador para desactivar un servicio.
 */
export const deactivateServiceSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("El identificador del servicio es inválido"),
});
