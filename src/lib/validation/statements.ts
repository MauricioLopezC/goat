import { z } from "@/lib/validation/zod";
import { DATE_PATTERN, isCalendarDate } from "@/lib/schedule";
import { MAX_STATEMENT_RANGE_DAYS, countDaysInclusive } from "@/lib/statements";

export const statementFilterSchema = z
  .object({
    from: z
      .string()
      .regex(DATE_PATTERN, "La fecha 'Desde' debe tener formato AAAA-MM-DD.")
      .refine(isCalendarDate, "La fecha 'Desde' no existe en el calendario."),
    to: z
      .string()
      .regex(DATE_PATTERN, "La fecha 'Hasta' debe tener formato AAAA-MM-DD.")
      .refine(isCalendarDate, "La fecha 'Hasta' no existe en el calendario."),
    professionalId: z.number().int().positive().optional(),
  })
  .refine((data) => data.from <= data.to, {
    message: "La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.",
    path: ["to"],
  })
  .refine(
    (data) =>
      countDaysInclusive(data.from, data.to) <= MAX_STATEMENT_RANGE_DAYS,
    {
      message: `El período no puede superar los tres meses (${MAX_STATEMENT_RANGE_DAYS} días).`,
      path: ["to"],
    },
  );

export type StatementFilterInput = z.infer<typeof statementFilterSchema>;
