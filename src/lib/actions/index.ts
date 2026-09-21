import "server-only";

// ─────────────────────── Códigos de error ────────────────────────────

/**
 * Códigos de error de dominio. Cada código mapea a un tipo de fallo
 * esperado. La lista se extiende en `docs/acciones.md` cuando una regla
 * de negocio nueva lo necesita.
 */
export type ErrorCode =
  | "VALIDATION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "APPOINTMENT_OVERLAP"
  | "PATIENT_APPOINTMENT_OVERLAP"
  | "OUTSIDE_AVAILABILITY_WINDOW"
  | "INVALID_STATUS_TRANSITION"
  | "REASON_REQUIRED";

// ─────────────────────── ActionResult ────────────────────────────────

/**
 * Resultado uniforme de todas las Server Actions. Los errores esperados
 * se devuelven como valor (`ok: false`); los inesperados se lanzan.
 */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ActionError };

export type ActionError = {
  code: ErrorCode;
  /** Mensaje en español, apto para mostrar al usuario. */
  message: string;
  /** Solo para `VALIDATION` y `DUPLICATE`: errores por campo. */
  fieldErrors?: Record<string, string[]>;
};

// ─────────────────────── DomainError ─────────────────────────────────

/**
 * Error de dominio que la DAL lanza cuando una regla de negocio falla.
 * `defineAction` lo convierte en `{ ok: false, error }`.
 */
export class DomainError extends Error {
  code: ErrorCode;
  fieldErrors?: Record<string, string[]>;

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
