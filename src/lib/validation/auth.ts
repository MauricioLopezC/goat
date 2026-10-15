import { z } from "@/lib/validation/zod";
import { STAFF_ROLES } from "@/lib/roles";

// Schemas de entrada de las operaciones de HU-01. Ver las fichas en
// docs/acciones.md.

/// Mínimo asumido al escribir las fichas, todavía sin confirmar con el cliente
/// (ver "A conversar" en HU-01).
const MIN_PASSWORD_LENGTH = 8;

const email = z
  .email()
  .trim()
  .toLowerCase()
  .max(254, "El email es demasiado largo");

export const signInSchema = z.object({
  email,
  // Sin mínimo: al ingresar no se valida el largo, porque cualquier fallo debe
  // devolver el mismo error genérico y no una pista sobre la contraseña.
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email,
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    )
    .max(200),
  // Solo los tres roles del centro: el paciente no accede (HU-01).
  role: z.enum(STAFF_ROLES),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => value || undefined),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresá tu contraseña actual"),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      )
      .max(200, "La contraseña es demasiado larga"),
    confirmPassword: z.string().min(1, "Confirmá tu nueva contraseña"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword && data.currentPassword === data.newPassword) {
      ctx.addIssue({
        code: "custom",
        message: "La nueva contraseña debe ser distinta de la actual",
        path: ["newPassword"],
      });
    }
    if (data.confirmPassword && data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Las contraseñas no coinciden",
        path: ["confirmPassword"],
      });
    }
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
