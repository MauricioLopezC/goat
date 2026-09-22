"use server";

import { revalidatePath } from "next/cache";
import * as dal from "@/lib/dal/professionals";
import { createProfessionalSchema } from "@/lib/validation/professional";
import { defineAction, type ActionResult } from "@/lib/actions";

/// Alta de profesional (HU-02). Ficha en docs/acciones.md.
///
/// `defineAction` verifica la sesión y el rol (MANAGER), valida con Zod
/// y traduce el `DomainError` de la DAL a `ActionResult`.
const create = defineAction({
  roles: ["MANAGER"],
  input: createProfessionalSchema,
  handler: async (input, actor) => {
    const professional = await dal.createProfessional(input, actor.id);
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
