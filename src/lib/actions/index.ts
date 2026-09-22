import "server-only";

import { z } from "@/lib/validation/zod";
import type { Role } from "@/generated/prisma/enums";
import { requireRole, type Actor } from "@/lib/dal/auth";

// Contrato de las Server Actions. La especificación está en docs/acciones.md y
// la decisión de fondo en el ADR 0001.

export type ErrorCode =
  | "VALIDATION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "APPOINTMENT_OVERLAP"
  | "PATIENT_APPOINTMENT_OVERLAP"
  | "OUTSIDE_AVAILABILITY_WINDOW"
  | "INVALID_STATUS_TRANSITION"
  | "REASON_REQUIRED"
  | "FUTURE_APPOINTMENTS";

export type ActionError = {
  code: ErrorCode;
  /// En español y apto para mostrar. La UI decide según `code`, nunca según
  /// este texto.
  message: string;
  /// Solo para `VALIDATION` y `DUPLICATE`.
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ActionError };

/// Error esperado de una regla de negocio. Lo lanza la DAL y `defineAction` lo
/// convierte en `{ ok: false }`. Cualquier otra excepción se relanza y la
/// maneja el `error.tsx` de la ruta.
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function fail(error: ActionError): { ok: false; error: ActionError } {
  return { ok: false, error };
}

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

type Handler<Input, Output> = (
  input: Input,
  actor: Actor,
) => Promise<Output> | Output;

/// Aplica el flujo obligatorio de `docs/acciones.md`: verifica sesión y rol,
/// valida la entrada con Zod y traduce `DomainError` a `ActionResult`.
///
/// Los roles y el schema se declaran en la firma, así que no se puede definir
/// una acción olvidándose de alguno de los dos.
export function defineAction<Input, Output>(config: {
  roles: Role[];
  input: z.ZodType<Input>;
  handler: Handler<Input, Output>;
}) {
  return async (raw: unknown): Promise<ActionResult<Output>> => {
    const actor = await requireRole(...config.roles);

    const parsed = config.input.safeParse(raw);
    if (!parsed.success) {
      return fail({
        code: "VALIDATION",
        message: "Revisá los datos ingresados.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      });
    }

    try {
      return ok(await config.handler(parsed.data, actor));
    } catch (error) {
      if (error instanceof DomainError) {
        return fail({
          code: error.code,
          message: error.message,
          fieldErrors: error.fieldErrors,
        });
      }
      throw error;
    }
  };
}
