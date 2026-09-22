import { z } from "@/lib/validation/zod";
import { GENDERS, COVERAGE_TYPES } from "@/lib/patients";

const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const phoneRegex = /^\+?\d{7,15}$/;
const dniRegex = /^\d{7,8}$/;

const parseOptionalNumber = (val: unknown) => {
  if (val === "" || val === undefined || val === null) return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? val : n;
};

export const createPatientSchema = z
  .object({
    lastName: z
      .string()
      .trim()
      .min(2, "El apellido debe tener al menos 2 caracteres")
      .max(60, "El apellido debe tener como máximo 60 caracteres")
      .regex(
        nameRegex,
        "El apellido solo puede contener letras, espacios, tildes y apóstrofes",
      ),
    firstName: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(60, "El nombre debe tener como máximo 60 caracteres")
      .regex(
        nameRegex,
        "El nombre solo puede contener letras, espacios, tildes y apóstrofes",
      ),
    gender: z.enum(GENDERS, {
      message: "Seleccioná un género válido",
    }),
    documentType: z.literal("DNI", {
      message: "Solo se permite DNI como tipo de documento",
    }),
    documentNumber: z
      .string()
      .trim()
      .regex(
        dniRegex,
        "El DNI debe tener exactamente 7 u 8 dígitos numéricos sin puntos ni espacios",
      ),
    birthDate: z
      .string()
      .trim()
      .min(1, "La fecha de nacimiento es obligatoria")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (formato AAAA-MM-DD)"),
    phone: z
      .string()
      .trim()
      .regex(
        phoneRegex,
        "El teléfono debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)",
      ),
    email: z
      .email("Correo electrónico inválido")
      .trim()
      .toLowerCase()
      .max(254, "El email es demasiado largo"),
    coverageType: z.enum(COVERAGE_TYPES, {
      message: "Seleccioná el tipo de cobertura",
    }),
    healthInsurerId: z.preprocess(
      parseOptionalNumber,
      z
        .number({ message: "Seleccioná una obra social" })
        .int()
        .positive()
        .optional(),
    ),
    insurancePlanId: z.preprocess(
      parseOptionalNumber,
      z.number({ message: "Seleccioná un plan" }).int().positive().optional(),
    ),
    memberNumber: z
      .string()
      .trim()
      .max(50)
      .optional()
      .transform((val) => val || undefined),
    guardianName: z
      .string()
      .trim()
      .max(
        120,
        "El nombre del responsable debe tener como máximo 120 caracteres",
      )
      .refine(
        (val) => !val || nameRegex.test(val),
        "El nombre del responsable solo puede contener letras, espacios, tildes y apóstrofes",
      )
      .optional()
      .transform((val) => val || undefined),
    guardianPhone: z
      .string()
      .trim()
      .max(25)
      .optional()
      .transform((val) => val || undefined),
  })
  .superRefine((data, ctx) => {
    if (data.birthDate) {
      const birth = new Date(`${data.birthDate}T00:00:00`);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (birth > today) {
        ctx.addIssue({
          code: "custom",
          message: "La fecha de nacimiento no puede ser futura",
          path: ["birthDate"],
        });
      } else {
        const minDate = new Date(
          now.getFullYear() - 120,
          now.getMonth(),
          now.getDate(),
        );
        if (birth < minDate) {
          ctx.addIssue({
            code: "custom",
            message: "La fecha de nacimiento no puede ser anterior a 120 años",
            path: ["birthDate"],
          });
        }
      }
    }

    if (data.coverageType === "HEALTH_INSURANCE") {
      if (!data.healthInsurerId) {
        ctx.addIssue({
          code: "custom",
          message: "La obra social es obligatoria",
          path: ["healthInsurerId"],
        });
      }
      if (!data.insurancePlanId) {
        ctx.addIssue({
          code: "custom",
          message: "El plan es obligatorio",
          path: ["insurancePlanId"],
        });
      }
      if (!data.memberNumber) {
        ctx.addIssue({
          code: "custom",
          message: "El número de afiliado es obligatorio",
          path: ["memberNumber"],
        });
      }
    }

    if (data.guardianPhone && !phoneRegex.test(data.guardianPhone)) {
      ctx.addIssue({
        code: "custom",
        message:
          "El teléfono del responsable debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)",
        path: ["guardianPhone"],
      });
    }
  });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
