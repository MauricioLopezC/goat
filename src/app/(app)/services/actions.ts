"use server";

import { revalidatePath } from "next/cache";
import * as dal from "@/lib/dal/services";
import {
  createServiceSchema,
  updateServiceSchema,
  deactivateServiceSchema,
} from "@/lib/validation/service";
import { defineAction, type ActionResult } from "@/lib/actions";

/// ─────────────────────── Mutaciones con defineAction ─────────────────────

const create = defineAction({
  roles: ["MANAGER"],
  input: createServiceSchema,
  handler: async (input, actor) => {
    const service = await dal.createService(input, actor);
    revalidatePath("/services");
    revalidatePath("/professionals");
    return service;
  },
});

const update = defineAction({
  roles: ["MANAGER"],
  input: updateServiceSchema,
  handler: async (input, actor) => {
    const service = await dal.updateService(input, actor);
    revalidatePath("/services");
    revalidatePath("/professionals");
    return service;
  },
});

const deactivate = defineAction({
  roles: ["MANAGER"],
  input: deactivateServiceSchema,
  handler: async (input, actor) => {
    const result = await dal.deactivateService(input.id, actor);
    revalidatePath("/services");
    revalidatePath("/professionals");
    return result;
  },
});

/// ─────────────────────── Adaptadores para UI ─────────────────────────────

export type SubmittedServiceValues = {
  id?: string;
  name: string;
  durationMinutes: string;
  requiresReferral: boolean;
  description: string;
  specialtyId: string;
};

export type ServiceFormState =
  | (ActionResult<{
      id: number;
      name: string;
      durationMinutes: number;
      requiresReferral: boolean;
    }> & {
      values?: SubmittedServiceValues;
    })
  | null;

function submitted(formData: FormData): SubmittedServiceValues {
  const read = (name: string) => String(formData.get(name) ?? "");
  return {
    id: read("id"),
    name: read("name"),
    durationMinutes: read("durationMinutes") || "30",
    requiresReferral:
      formData.get("requiresReferral") === "on" ||
      formData.get("requiresReferral") === "true",
    description: read("description"),
    specialtyId: read("specialtyId"),
  };
}

/**
 * Server Action: dar de alta un servicio.
 */
export async function createServiceAction(
  _previous: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const raw = {
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    requiresReferral: formData.get("requiresReferral") === "on",
    description: formData.get("description") || null,
    specialtyId: formData.get("specialtyId") || null,
  };

  const result = await create(raw);

  if (!result.ok) {
    return { ...result, values: submitted(formData) };
  }

  return { ok: true, data: result.data };
}

/**
 * Server Action: actualizar un servicio.
 */
export async function updateServiceAction(
  _previous: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const raw = {
    id: formData.get("id"),
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    requiresReferral: formData.get("requiresReferral") === "on",
    description: formData.get("description") || null,
    specialtyId: formData.get("specialtyId") || null,
  };

  const result = await update(raw);

  if (!result.ok) {
    return { ...result, values: submitted(formData) };
  }

  return { ok: true, data: result.data };
}

/**
 * Server Action: baja lógica de un servicio.
 */
export async function deactivateServiceAction(
  _previous: ActionResult<{ id: number; name: string; active: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: number; name: string; active: boolean }>> {
  const raw = {
    id: formData.get("id"),
  };

  return deactivate(raw);
}
