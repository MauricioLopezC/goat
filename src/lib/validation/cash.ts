import { z } from "@/lib/validation/zod";
import { DATE_PATTERN, isCalendarDate } from "@/lib/schedule";

// Cierre de caja (HU-27).

export const closeCashSchema = z.object({
  date: z
    .string()
    .regex(DATE_PATTERN, "La fecha debe tener el formato AAAA-MM-DD.")
    .refine(isCalendarDate, "La fecha ingresada no existe en el calendario."),
  countedCashAmount: z.coerce
    .number({ error: "Ingresá un monto de efectivo válido." })
    .nonnegative("El efectivo contado no puede ser negativo.")
    .multipleOf(0.01, "El efectivo contado admite como máximo dos decimales."),
  notes: z
    .string()
    .trim()
    .max(500, "Las observaciones no pueden superar los 500 caracteres.")
    .nullish()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export type CloseCashInput = z.input<typeof closeCashSchema>;
export type CloseCashOutput = z.output<typeof closeCashSchema>;
