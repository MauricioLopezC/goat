"use server";

import { revalidatePath } from "next/cache";
import * as dal from "@/lib/dal/professionals";
import { cancelProfessionalAppointment as cancelAppointmentInDal } from "@/lib/dal/appointments";
import { z } from "@/lib/validation/zod";
import {
  createProfessionalSchema,
  updateProfessionalSchema,
  deactivateProfessionalSchema,
  reactivateProfessionalSchema,
} from "@/lib/validation/professional";
import {
  defineAction,
  DomainError,
  fail,
  type ActionResult,
} from "@/lib/actions";
import { requireRole } from "@/lib/dal/auth";

import {
  validatePhotoFile,
  saveProfessionalPhoto,
  deleteProfessionalPhoto,
} from "@/lib/storage/photos";

/// Alta de profesional (HU-02). Ficha en docs/acciones.md.
///
/// `defineAction` verifica la sesión y el rol (MANAGER), valida con Zod
/// y traduce el `DomainError` de la DAL a `ActionResult`.
const create = defineAction({
  roles: ["MANAGER"],
  input: createProfessionalSchema,
  handler: async (input, actor) => {
    const professional = await dal.createProfessional(input, actor);
    // Revalidar es responsabilidad de la acción, no de la DAL (ADR 0001).
    revalidatePath("/professionals");
    revalidatePath("/profesionales");
    return professional;
  },
});

/// Lo que se devuelve al formulario para no perder lo cargado cuando algo falla.
export type SubmittedProfessionalValues = {
  lastName: string;
  firstName: string;
  documentType: string;
  documentNumber: string;
  licenseNumber: string;
  phone: string;
  email: string;
  notes: string;
  titleIds: number[];
  serviceIds: number[];
};

export type CreateProfessionalState =
  | (ActionResult<{ id: number; firstName: string; lastName: string }> & {
      values?: SubmittedProfessionalValues;
    })
  | null;

function submitted(formData: FormData): SubmittedProfessionalValues {
  const read = (name: string) => String(formData.get(name) ?? "");
  return {
    lastName: read("lastName"),
    firstName: read("firstName"),
    documentType: read("documentType") || "DNI",
    documentNumber: read("documentNumber"),
    licenseNumber: read("licenseNumber"),
    phone: read("phone"),
    email: read("email"),
    notes: read("notes"),
    titleIds: formData.getAll("titleIds").map(Number),
    serviceIds: formData.getAll("serviceIds").map(Number),
  };
}

export async function createProfessional(
  _previous: CreateProfessionalState,
  formData: FormData,
): Promise<CreateProfessionalState> {
  try {
    await requireRole("MANAGER");
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        ...fail({ code: error.code, message: error.message }),
        values: submitted(formData),
      };
    }
    throw error;
  }

  const photoFile = formData.get("photo");
  let photoUrl: string | null = null;

  if (
    photoFile &&
    typeof photoFile === "object" &&
    "size" in photoFile &&
    (photoFile as File).size > 0
  ) {
    const file = photoFile as File;
    const validation = validatePhotoFile(file);
    if (!validation.ok) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: validation.error,
          fieldErrors: { photo: [validation.error] },
        },
        values: submitted(formData),
      };
    }
    try {
      photoUrl = await saveProfessionalPhoto(file);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message:
            error instanceof Error ? error.message : "Error al guardar la foto",
          fieldErrors: { photo: ["No se pudo guardar la imagen"] },
        },
        values: submitted(formData),
      };
    }
  }

  // En FormData, los campos de arrays vienen con getAll
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
    photoUrl,
    notes: formData.get("notes") || null,
  };

  const result = await create(raw);

  if (!result.ok) {
    if (photoUrl) {
      await deleteProfessionalPhoto(photoUrl);
    }
    return { ...result, values: submitted(formData) };
  }

  return { ok: true, data: result.data };
}

const update = defineAction({
  roles: ["MANAGER"],
  input: updateProfessionalSchema,
  handler: async (input, actor) => {
    const result = await dal.updateProfessional(input, actor);
    revalidatePath("/professionals");
    revalidatePath("/profesionales");
    revalidatePath(`/professionals/${input.id}`);
    revalidatePath(`/professionals/${input.id}/edit`);
    return result;
  },
});

const deactivate = defineAction({
  roles: ["MANAGER"],
  input: deactivateProfessionalSchema,
  handler: async (input, actor) => {
    const result = await dal.deactivateProfessional(input, actor);
    revalidatePath("/professionals");
    revalidatePath("/profesionales");
    revalidatePath(`/professionals/${input.id}`);
    revalidatePath(`/professionals/${input.id}/edit`);
    return result;
  },
});

const reactivate = defineAction({
  roles: ["MANAGER"],
  input: reactivateProfessionalSchema,
  handler: async (input, actor) => {
    const result = await dal.reactivateProfessional(input, actor);
    revalidatePath("/professionals");
    revalidatePath("/profesionales");
    revalidatePath(`/professionals/${input.id}`);
    revalidatePath(`/professionals/${input.id}/edit`);
    return result;
  },
});

export type ProfessionalMutationState = ActionResult<{
  id: number;
  firstName?: string;
  lastName?: string;
  active?: boolean;
}> | null;

export async function updateProfessional(
  _previous: ProfessionalMutationState,
  formData: FormData,
): Promise<ProfessionalMutationState> {
  try {
    await requireRole("MANAGER");
  } catch (error) {
    if (error instanceof DomainError) {
      return fail({ code: error.code, message: error.message });
    }
    throw error;
  }

  const id = Number(formData.get("id"));
  const removePhoto = formData.get("removePhoto") === "true";
  const photoFile = formData.get("photo");
  let photoUrl: string | null | undefined = undefined;

  if (removePhoto) {
    photoUrl = null;
  } else if (
    photoFile &&
    typeof photoFile === "object" &&
    "size" in photoFile &&
    (photoFile as File).size > 0
  ) {
    const file = photoFile as File;
    const validation = validatePhotoFile(file);
    if (!validation.ok) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: validation.error,
          fieldErrors: { photo: [validation.error] },
        },
      };
    }
    try {
      photoUrl = await saveProfessionalPhoto(file);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message:
            error instanceof Error ? error.message : "Error al guardar la foto",
          fieldErrors: { photo: ["No se pudo guardar la imagen"] },
        },
      };
    }
  }

  const result = await update({
    id,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    licenseNumber: formData.get("licenseNumber"),
    titleIds: formData.getAll("titleIds").map(Number),
    serviceIds: formData.getAll("serviceIds").map(Number),
    phone: formData.get("phone"),
    email: formData.get("email"),
    photoUrl,
    notes: formData.get("notes"),
    reason: formData.get("reason"),
  });

  if (result.ok) {
    const previousPhotoToDelete = result.data.previousPhotoUrl;
    if (
      (removePhoto || photoUrl !== undefined) &&
      previousPhotoToDelete &&
      previousPhotoToDelete !== photoUrl
    ) {
      await deleteProfessionalPhoto(previousPhotoToDelete);
    }
    return {
      ok: true,
      data: {
        id: result.data.id,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
      },
    };
  }

  if (photoUrl) {
    await deleteProfessionalPhoto(photoUrl);
  }

  return result;
}

export async function deactivateProfessional(
  _previous: ProfessionalMutationState,
  formData: FormData,
): Promise<ProfessionalMutationState> {
  return deactivate({
    id: Number(formData.get("id")),
    reason: formData.get("reason"),
    deactivatedAt: formData.get("deactivatedAt"),
  });
}

export async function reactivateProfessional(
  _previous: ProfessionalMutationState,
  formData: FormData,
): Promise<ProfessionalMutationState> {
  return reactivate({
    id: Number(formData.get("id")),
    reason: formData.get("reason"),
  });
}

const cancel = defineAction({
  roles: ["MANAGER"],
  input: z.object({
    appointmentId: z.number().int().positive(),
    professionalId: z.number().int().positive(),
    reason: z.string().trim().min(1, "El motivo es obligatorio").max(500),
    requestedBy: z
      .string()
      .trim()
      .min(1, "Indicá quién solicitó la cancelación")
      .max(100),
  }),
  handler: async (input, actor) => {
    const result = await cancelAppointmentInDal(input, actor);
    revalidatePath(`/professionals/${input.professionalId}`);
    revalidatePath(`/professionals/${input.professionalId}/edit`);
    return result;
  },
});

export type CancelAppointmentState = ActionResult<{ id: number }> | null;

export async function cancelProfessionalAppointment(
  _previous: CancelAppointmentState,
  formData: FormData,
): Promise<CancelAppointmentState> {
  return cancel({
    appointmentId: Number(formData.get("appointmentId")),
    professionalId: Number(formData.get("professionalId")),
    reason: formData.get("reason"),
    requestedBy: formData.get("requestedBy"),
  });
}
