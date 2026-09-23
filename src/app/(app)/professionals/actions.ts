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
import { defineAction, type ActionResult } from "@/lib/actions";

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
    notes: formData.get("notes") || null,
  };

  const result = await create(raw);

  if (!result.ok) {
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
  return update({
    id: Number(formData.get("id")),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    licenseNumber: formData.get("licenseNumber"),
    titleIds: formData.getAll("titleIds").map(Number),
    serviceIds: formData.getAll("serviceIds").map(Number),
    phone: formData.get("phone"),
    email: formData.get("email"),
    photoUrl: formData.get("photoUrl"),
    notes: formData.get("notes"),
    reason: formData.get("reason"),
  });
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
