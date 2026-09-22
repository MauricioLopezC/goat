import { z } from "@/lib/validation/zod";

/**
 * Tipos de documento válidos. Deben coincidir con el enum `DocumentType`
 * de Prisma (prisma/schema.prisma).
 */
const documentTypes = ["DNI", "LC", "LE", "CI", "PASSPORT"] as const;

/**
 * Schema de validación para crear un profesional (HU-02).
 *
 * Valida la forma de los datos. Las reglas de unicidad (documento y
 * matrícula duplicados) las verifica la DAL contra la base de datos.
 */
export const createProfessionalSchema = z
  .object({
    lastName: z.string().trim().min(1).max(100),

    firstName: z.string().trim().min(1).max(100),

    documentType: z.enum(documentTypes),

    documentNumber: z.string().trim().min(1).max(20),

    /** Matrícula: numérica, de 1 a 8 dígitos (decisión del cliente). */
    licenseNumber: z
      .string()
      .trim()
      .regex(/^\d{1,8}$/, "La matrícula debe ser numérica, de 1 a 8 dígitos"),

    /** Al menos un título profesional (traumatólogo, kinesiólogo, etc.). */
    titleIds: z
      .array(z.number().int().positive())
      .min(1, "Debe seleccionar al menos un título profesional"),

    /** Al menos un servicio del catálogo (HU-06). */
    serviceIds: z
      .array(z.number().int().positive())
      .min(1, "Debe seleccionar al menos un servicio"),

    phone: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null)),
      z
        .string()
        .trim()
        .regex(
          /^[\d\s+\-()]{6,30}$/,
          "El teléfono solo puede contener números, guiones o espacios",
        )
        .nullable(),
    ),

    email: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null)),
      z.string().trim().toLowerCase().email().nullable(),
    ),

    photoUrl: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null)),
      z.string().trim().url().nullable(),
    ),

    notes: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null)),
      z.string().trim().max(500).nullable(),
    ),
  })
  .superRefine((data, ctx) => {
    // Validación según tipo de documento
    if (data.documentType === "DNI") {
      if (!/^\d{7,8}$/.test(data.documentNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["documentNumber"],
          message: "El DNI debe tener 7 u 8 dígitos numéricos",
        });
      }
    } else if (["LC", "LE", "CI"].includes(data.documentType)) {
      if (!/^\d{6,8}$/.test(data.documentNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["documentNumber"],
          message: "El documento debe ser numérico (6 a 8 dígitos)",
        });
      }
    } else if (data.documentType === "PASSPORT") {
      if (!/^[A-Za-z0-9]{3,20}$/.test(data.documentNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["documentNumber"],
          message: "El pasaporte debe ser alfanumérico (3 a 20 caracteres)",
        });
      }
    }
  });

export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;

export const updateProfessionalSchema = createProfessionalSchema.safeExtend({
  id: z.number().int().positive(),
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(500),
});

export const deactivateProfessionalSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(500),
  deactivatedAt: z.iso.date(),
});

export const reactivateProfessionalSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(500),
});
