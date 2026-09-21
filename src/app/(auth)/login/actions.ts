"use server";

import { redirect } from "next/navigation";
import * as dal from "@/lib/dal/auth";
import { signInSchema } from "@/lib/validation/auth";
import { z } from "@/lib/validation/zod";
import { DomainError, type ActionResult } from "@/lib/actions";

// signIn y signOut no pasan por `defineAction`: una corre sin sesión por
// definición y la otra acepta cualquier rol, así que no tienen roles que
// declarar (ver docs/acciones.md). El resto del flujo es el mismo.

export type SignInState = ActionResult<never> | null;

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos ingresados.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      },
    };
  }

  let destination: string;
  try {
    destination = await dal.signIn(parsed.data);
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    throw error;
  }

  // Fuera del try: `redirect` corta la ejecución lanzando, y atraparlo acá lo
  // convertiría en un error de la acción.
  redirect(destination);
}

export async function signOut() {
  await dal.signOut();
  redirect("/login");
}
