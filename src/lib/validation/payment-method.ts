import { z } from "@/lib/validation/zod";

/**
 * Validador para crear un nuevo medio de pago (HU-20).
 *
 * Reglas de negocio:
 * - Nombre obligatorio, entre 1 y 80 caracteres.
 */
export const createPaymentMethodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del medio de pago es obligatorio")
    .max(80, "El nombre no puede superar los 80 caracteres"),
});

export type CreatePaymentMethodInput = z.infer<
  typeof createPaymentMethodSchema
>;

/**
 * Validador para actualizar un medio de pago existente (HU-20).
 *
 * Reglas de negocio:
 * - Nombre obligatorio, entre 1 y 80 caracteres.
 * - Estado: activo o inactivo (no se puede desactivar el último activo).
 */
export const updatePaymentMethodSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("El identificador del medio de pago es inválido"),

  name: z
    .string()
    .trim()
    .min(1, "El nombre del medio de pago es obligatorio")
    .max(80, "El nombre no puede superar los 80 caracteres"),

  active: z.preprocess((val) => {
    if (typeof val === "boolean") return val;
    if (val === "on" || val === "true" || val === "1") return true;
    return false;
  }, z.boolean()),
});

export type UpdatePaymentMethodInput = z.infer<
  typeof updatePaymentMethodSchema
>;
