import { z } from "@/lib/validation/zod";
import {
  MAX_PERIOD_MONTHS,
  MONTH_PATTERN,
  periodMonthCount,
} from "@/lib/indicators";

const monthSchema = z.string().regex(MONTH_PATTERN, "Elegí un mes válido.");

/// Período y filtro del tablero (HU-22).
export const centerIndicatorsSchema = z
  .object({
    from: monthSchema,
    to: monthSchema,
    professionalId: z.number().int().positive().optional(),
  })
  .refine((period) => periodMonthCount(period) >= 1, {
    message: "El mes de inicio no puede ser posterior al de fin.",
    path: ["to"],
  })
  .refine((period) => periodMonthCount(period) <= MAX_PERIOD_MONTHS, {
    message: `El período puede abarcar hasta ${MAX_PERIOD_MONTHS} meses.`,
    path: ["to"],
  });
export type CenterIndicatorsInput = z.infer<typeof centerIndicatorsSchema>;
