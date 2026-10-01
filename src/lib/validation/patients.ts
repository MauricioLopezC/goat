import { z } from "@/lib/validation/zod";
import { GENDERS, COVERAGE_TYPES, DOCUMENT_TYPES } from "@/lib/patients";

const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const phoneRegex = /^\+?\d{7,15}$/;
const dniRegex = /^\d{7,8}$/;

const parseOptionalNumber = (val: unknown) => {
  if (val === "" || val === undefined || val === null) return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? val : n;
};

export const patientBaseFields = {
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
  documentType: z.enum(DOCUMENT_TYPES, {
    message: "Seleccioná un tipo de documento válido",
  }),
  documentNumber: z
    .string()
    .trim()
    .min(1, "El número de documento es obligatorio")
    .max(20, "El número de documento es demasiado largo"),
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
    .max(120, "El nombre del responsable debe tener como máximo 120 caracteres")
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
};

type PatientDocumentForRefine = {
  documentType: (typeof DOCUMENT_TYPES)[number];
  documentNumber: string;
};

type PatientDataForRefine = {
  birthDate: string;
  guardianName?: string;
  guardianPhone?: string;
  coverageType: (typeof COVERAGE_TYPES)[number];
  healthInsurerId?: number;
  insurancePlanId?: number;
  memberNumber?: string;
};

/// Formato del documento. Solo aplica al alta: una vez creado el paciente, el
/// documento no se modifica (HU-08).
export const refinePatientDocument = (
  data: PatientDocumentForRefine,
  ctx: z.RefinementCtx,
) => {
  if (data.documentType === "DNI") {
    if (!dniRegex.test(data.documentNumber)) {
      ctx.addIssue({
        code: "custom",
        message:
          "El DNI debe tener exactamente 7 u 8 dígitos numéricos sin puntos ni espacios",
        path: ["documentNumber"],
      });
    }
  } else if (data.documentType === "PASSPORT") {
    if (!/^[a-zA-Z0-9]{3,20}$/.test(data.documentNumber)) {
      ctx.addIssue({
        code: "custom",
        message:
          "El pasaporte debe tener entre 3 y 20 caracteres alfanuméricos",
        path: ["documentNumber"],
      });
    }
  } else {
    if (!/^\d{4,10}$/.test(data.documentNumber)) {
      ctx.addIssue({
        code: "custom",
        message:
          "El número de documento debe tener entre 4 y 10 dígitos numéricos",
        path: ["documentNumber"],
      });
    }
  }
};

export const refinePatient = (
  data: PatientDataForRefine,
  ctx: z.RefinementCtx,
) => {
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
      } else {
        // Validar tutor obligatorio si el paciente es menor de 16 años
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        if (age < 16) {
          if (!data.guardianName?.trim()) {
            ctx.addIssue({
              code: "custom",
              message:
                "El nombre del responsable es obligatorio para menores de 16 años",
              path: ["guardianName"],
            });
          }
          if (!data.guardianPhone?.trim()) {
            ctx.addIssue({
              code: "custom",
              message:
                "El teléfono del responsable es obligatorio para menores de 16 años",
              path: ["guardianPhone"],
            });
          }
        }
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
};

type EmergencyContactDataForRefine = {
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
};

/// Regla cruzada y formato para el contacto de emergencia (HU-17).
export const refineEmergencyContact = (
  data: EmergencyContactDataForRefine,
  ctx: z.RefinementCtx,
) => {
  const hasName = Boolean(data.emergencyContactName?.trim());
  const hasPhone = Boolean(data.emergencyContactPhone?.trim());
  const hasRelationship = Boolean(data.emergencyContactRelationship?.trim());

  if ((hasName || hasRelationship) && !hasPhone) {
    ctx.addIssue({
      code: "custom",
      message:
        "El teléfono es obligatorio si se indica el contacto de emergencia",
      path: ["emergencyContactPhone"],
    });
  }

  if (hasPhone && !hasName) {
    ctx.addIssue({
      code: "custom",
      message:
        "El nombre es obligatorio si se indica el teléfono de emergencia",
      path: ["emergencyContactName"],
    });
  } else if (hasRelationship && !hasName) {
    ctx.addIssue({
      code: "custom",
      message:
        "El nombre es obligatorio si se indica el contacto de emergencia",
      path: ["emergencyContactName"],
    });
  }

  if (hasPhone && !phoneRegex.test(data.emergencyContactPhone!.trim())) {
    ctx.addIssue({
      code: "custom",
      message:
        "El teléfono del contacto de emergencia debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)",
      path: ["emergencyContactPhone"],
    });
  }
};

export const createPatientSchema = z
  .object(patientBaseFields)
  .superRefine((data, ctx) => {
    refinePatientDocument(data, ctx);
    refinePatient(data, ctx);
  });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

/// Campos opcionales de ficha completa (HU-17). El alta (HU-07) no se alarga:
/// solo se completan con posterioridad desde la edición de la ficha.
export const patientExtendedFields = {
  address: z
    .string()
    .trim()
    .max(120, "El domicilio debe tener como máximo 120 caracteres")
    .optional()
    .transform((val) => val || undefined),
  city: z
    .string()
    .trim()
    .max(60, "La localidad debe tener como máximo 60 caracteres")
    .optional()
    .transform((val) => val || undefined),
  emergencyContactName: z
    .string()
    .trim()
    .max(
      120,
      "El nombre del contacto de emergencia debe tener como máximo 120 caracteres",
    )
    .refine(
      (val) => !val || nameRegex.test(val),
      "El nombre del contacto de emergencia solo puede contener letras, espacios, tildes y apóstrofes",
    )
    .optional()
    .transform((val) => val || undefined),
  emergencyContactPhone: z
    .string()
    .trim()
    .max(25)
    .optional()
    .transform((val) => val || undefined),
  emergencyContactRelationship: z
    .string()
    .trim()
    .max(50, "El vínculo debe tener como máximo 50 caracteres")
    .optional()
    .transform((val) => val || undefined),
  notes: z
    .string()
    .trim()
    .max(1000, "Las observaciones deben tener como máximo 1000 caracteres")
    .optional()
    .transform((val) => val || undefined),
};

/// El documento no es editable (HU-08). Se acepta opcional solo para que la DAL
/// rechace un intento de cambiarlo en vez de que Zod lo descarte sin avisar.
/// La ficha completa suma los campos opcionales de HU-17.
export const updatePatientSchema = z
  .object(patientBaseFields)
  .omit({ documentType: true, documentNumber: true })
  .extend({
    id: z.number().int().positive("ID de paciente inválido"),
    documentType: z
      .enum(DOCUMENT_TYPES, {
        message: "Seleccioná un tipo de documento válido",
      })
      .optional(),
    documentNumber: z.string().trim().optional(),
    ...patientExtendedFields,
  })
  .superRefine((data, ctx) => {
    refinePatient(data, ctx);
    refineEmergencyContact(data, ctx);
  });

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
