import { z } from "@/lib/validation/zod";
import { Weekday } from "@/generated/prisma/enums";
import { TIME_PATTERN, isCalendarDate, parseTime } from "@/lib/schedule";

// Agenda de un profesional y feriados (HU-05). Zod valida la forma; que la
// fecha no sea pasada, la pertenencia y los turnos afectados los verifica la
// DAL.

const id = z.number().int().positive();

const time = z
  .string()
  .trim()
  .regex(TIME_PATTERN, "Hora inválida (formato HH:MM)");

const date = z
  .string()
  .trim()
  .refine(isCalendarDate, "Fecha inválida (formato AAAA-MM-DD)");

const checkbox = z.preprocess(
  (value) => value === true || value === "on" || value === "true",
  z.boolean(),
);

/// Campos de una franja, tal como llegan del formulario.
const windowFields = z.object({
  professionalId: id,
  weekday: z.enum(Weekday),
  startTime: time,
  endTime: time,
  roomId: z.preprocess(
    (value) => (value === "" || value === 0 ? null : value),
    id.nullable(),
  ),
  serviceIds: z.array(id),
});

/// Valida el orden de los horarios y los pasa a minutos.
function toWindow<T extends z.infer<typeof windowFields>>(
  schema: z.ZodType<T>,
) {
  return schema
    .refine((data) => parseTime(data.endTime) > parseTime(data.startTime), {
      path: ["endTime"],
      message: "La hora de fin debe ser posterior a la de inicio",
    })
    .transform(({ startTime, endTime, serviceIds, ...rest }) => ({
      ...rest,
      startMinute: parseTime(startTime),
      endMinute: parseTime(endTime),
      serviceIds: Array.from(new Set(serviceIds)),
    }));
}

export const createAvailabilityWindowSchema = toWindow(windowFields);

export const updateAvailabilityWindowSchema = toWindow(
  windowFields.extend({ id }),
);

export const deleteAvailabilityWindowSchema = z.object({
  id,
  professionalId: id,
});

export const createAvailabilityExceptionSchema = z
  .object({
    professionalId: id,
    date,
    allDay: checkbox,
    startTime: time.nullish(),
    endTime: time.nullish(),
    reason: z.string().trim().min(1, "El motivo es obligatorio").max(200),
  })
  .superRefine((data, ctx) => {
    if (data.allDay) return;
    if (!data.startTime)
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Indicá la hora de inicio o marcá el día completo",
      });
    if (!data.endTime)
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Indicá la hora de fin o marcá el día completo",
      });
    if (
      data.startTime &&
      data.endTime &&
      parseTime(data.endTime) <= parseTime(data.startTime)
    )
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "La hora de fin debe ser posterior a la de inicio",
      });
  })
  .transform(({ allDay, startTime, endTime, ...rest }) => ({
    ...rest,
    // Ambos nulos es el día entero (ver el schema de Prisma).
    startMinute: allDay || !startTime ? null : parseTime(startTime),
    endMinute: allDay || !endTime ? null : parseTime(endTime),
  }));

export const deleteAvailabilityExceptionSchema = z.object({
  id,
  professionalId: id,
});

export const createHolidaySchema = z.object({
  date,
  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(120),
});

export const deleteHolidaySchema = z.object({ id });

export type AvailabilityWindowInput = z.output<
  typeof createAvailabilityWindowSchema
>;
export type UpdateAvailabilityWindowInput = z.output<
  typeof updateAvailabilityWindowSchema
>;
export type AvailabilityExceptionInput = z.output<
  typeof createAvailabilityExceptionSchema
>;
export type HolidayInput = z.output<typeof createHolidaySchema>;
