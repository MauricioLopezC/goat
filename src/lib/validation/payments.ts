import { z } from "@/lib/validation/zod";

// Cobro y autorización de un turno (HU-21).

export const registerPaymentSchema = z.object({
  appointmentId: z.number().int().positive(),
  paymentMethodId: z
    .number({ error: "Elegí un medio de pago." })
    .int()
    .positive("Elegí un medio de pago."),
});
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

/// El motivo vacío no lo rechaza el schema: la DAL devuelve `REASON_REQUIRED`,
/// igual que al cancelar un turno.
export const voidPaymentSchema = z.object({
  paymentId: z.number().int().positive(),
  reason: z.string().trim().max(500),
});
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

export const registerAuthorizationSchema = z.object({
  appointmentId: z.number().int().positive(),
  authorizationNumber: z
    .string()
    .trim()
    .min(1, "Ingresá el número de autorización.")
    .max(50, "El número no puede superar los 50 caracteres."),
});
export type RegisterAuthorizationInput = z.infer<
  typeof registerAuthorizationSchema
>;
