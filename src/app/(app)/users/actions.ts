"use server";

import { revalidatePath } from "next/cache";
import * as dal from "@/lib/dal/auth";
import { createUserSchema } from "@/lib/validation/auth";
import { defineAction, type ActionResult } from "@/lib/actions";

/// Alta de usuario (HU-01). Ficha en docs/acciones.md.
///
/// `defineAction` verifica la sesión y el rol, valida con Zod y traduce el
/// `DomainError` de la DAL a `ActionResult`.
const create = defineAction({
  roles: ["MANAGER"],
  input: createUserSchema,
  handler: async (input, actor) => {
    const user = await dal.createUser(input, actor);
    // Revalidar es responsabilidad de la acción, no de la DAL (ADR 0001).
    revalidatePath("/users");
    return user;
  },
});

/// Lo que se devuelve al formulario para no perder lo cargado cuando algo
/// falla. Nunca incluye la contraseña: se vuelve a escribir.
export type SubmittedValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
};

/// `ActionResult` más los valores del intento. Los valores son cosa de esta
/// pantalla, no del contrato de acciones: viajan para que el formulario se
/// vuelva a dibujar con lo que la persona había escrito, incluso sin JS.
export type CreateUserState =
  | (ActionResult<{ firstName: string; lastName: string; email: string }> & {
      values?: SubmittedValues;
    })
  | null;

function submitted(formData: FormData): SubmittedValues {
  const read = (name: string) => String(formData.get(name) ?? "");
  return {
    firstName: read("firstName"),
    lastName: read("lastName"),
    email: read("email"),
    phone: read("phone"),
    role: read("role"),
  };
}

export async function createUser(
  _previous: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const result = await create(Object.fromEntries(formData));

  if (!result.ok) return { ...result, values: submitted(formData) };

  const { firstName, lastName, email } = result.data;
  // Sin `values`: el alta salió bien y el formulario arranca limpio para el
  // usuario siguiente.
  return { ok: true, data: { firstName, lastName, email } };
}
