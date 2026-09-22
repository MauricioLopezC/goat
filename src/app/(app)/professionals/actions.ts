"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions";
import { DomainError } from "@/lib/actions";
import { requireRole } from "@/lib/dal/auth";
import { createProfessional as dalCreateProfessional } from "@/lib/dal/professionals";
import { createProfessionalSchema } from "@/lib/validation/professional";

/**
 * Server Action: registrar un profesional (HU-02).
 *
 * Flujo obligatorio (docs/acciones.md):
 * 1. Sesión y rol (MANAGER)
 * 2. Validar entrada con Zod
 * 3. Llamar a la DAL
 * 4. Revalidar rutas
 * 5. Devolver ActionResult
 */
export async function createProfessional(
  _prevState: ActionResult<{
    id: number;
    firstName: string;
    lastName: string;
  }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: number; firstName: string; lastName: string }>> {
  // ── 1. Sesión y rol: solo MANAGER puede crear profesionales ───────
  let actor;
  try {
    actor = await requireRole("MANAGER");
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    throw error;
  }

  // ── 2. Parsear y validar la entrada con Zod ───────────────────────
  const raw = {
    lastName: formData.get("lastName"),
    firstName: formData.get("firstName"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    licenseNumber: formData.get("licenseNumber"),
    titleIds: formData.getAll("titleIds").map(Number),
    serviceIds: formData.getAll("serviceIds").map(Number),
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    photoUrl: formData.get("photoUrl") || null,
    notes: formData.get("notes") || null,
  };

  const parsed = createProfessionalSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<
      string,
      string[]
    >;
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Hay errores en el formulario. Revisá los campos marcados.",
        fieldErrors,
      },
    };
  }

  // ── 3. Llamar a la DAL con el ID del usuario real logueado ────────
  try {
    const professional = await dalCreateProfessional(parsed.data, actor.id);

    // ── 4. Revalidar el listado de profesionales ────────────────────
    revalidatePath("/professionals");

    // ── 5. Devolver ActionResult ─────────────────────────────────────
    return { ok: true, data: professional };
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          fieldErrors: error.fieldErrors,
        },
      };
    }
    // Error inesperado: se relanza para que lo maneje error.tsx
    throw error;
  }
}
