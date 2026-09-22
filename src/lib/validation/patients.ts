import { z } from "@/lib/validation/zod";
import { DOCUMENT_TYPES, GENDERS, COVERAGE_TYPES } from "@/lib/patients";

const phoneRegex = /^[\d\s+\-()]{7,25}$/;

const parseOptionalNumber = (val: unknown) => {
  if (val === "" || val === undefined || val === null) return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? val : n;
};

export const createPatientSchema = z
  .object({
    lastName: z.string().trim().min(1, "El apellido es obligatorio").max(60),
    firstName: z.string().trim().min(1, "El nombre es obligatorio").max(60),
    gender: z.enum(GENDERS, {
      message: "Seleccioná un género válido",
    }),
    documentType: z.enum(DOCUMENT_TYPES, {
      message: "Seleccioná un tipo de documento válido",
    }),
    documentNumber: z
      .string()
      .trim()
      .min(1, "El número de documento es obligatorio")
      .max(20)
      .regex(
        /^[\w\d.-]+$/,
        "El número de documento contiene caracteres inválidos",
      ),
    birthDate: z
      .string()
      .trim()
      .min(1, "La fecha de nacimiento es obligatoria")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (formato AAAA-MM-DD)"),
    phone: z
      .string()
      .trim()
      .min(1, "El teléfono es obligatorio")
      .regex(phoneRegex, "Formato de teléfono inválido (mínimo 7 dígitos)"),
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
    copayAmount: z.preprocess(
      parseOptionalNumber,
      z.number().min(0, "El coseguro no puede ser negativo").optional(),
    ),
    guardianName: z
      .string()
      .trim()
      .max(120)
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
      if (data.copayAmount === undefined || data.copayAmount === null) {
        ctx.addIssue({
          code: "custom",
          message: "El coseguro es obligatorio",
          path: ["copayAmount"],
        });
      }
    }

    if (data.guardianPhone && !phoneRegex.test(data.guardianPhone)) {
      ctx.addIssue({
        code: "custom",
        message: "Formato de teléfono de contacto inválido",
        path: ["guardianPhone"],
      });
    }
  });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
