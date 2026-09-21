import "server-only";

import type { Role } from "@/generated/prisma/enums";

/**
 * Sesión del usuario autenticado. La forma definitiva la define el ADR
 * de autenticación (pendiente); esta interfaz es el mínimo que necesitan
 * las acciones y la DAL.
 */
export interface Session {
  userId: number;
  role: Role;
}

/**
 * Obtiene la sesión actual. Stub temporal: devuelve un usuario MANAGER
 * fijo para poder desarrollar sin que la HU-01 esté lista.
 *
 * TODO: reemplazar con la implementación real cuando se resuelva el ADR
 * de autenticación.
 */
export async function getSession(): Promise<Session | null> {
  // ── Stub: simula un gerente logueado ──────────────────────────────
  return { userId: 1, role: "MANAGER" };
}

/**
 * Verifica que haya sesión y que el rol esté en la lista permitida.
 * Redirige al login si no hay sesión; lanza DomainError si el rol no
 * alcanza.
 */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();

  if (!session) {
    // Sin sesión → redirigir al login (por ahora lanzamos).
    throw new Error("No hay sesión activa. Redirigir al login.");
  }

  if (!roles.includes(session.role)) {
    const { DomainError } = await import("@/lib/actions");
    throw new DomainError(
      "FORBIDDEN",
      "No tenés permisos para realizar esta operación.",
    );
  }

  return session;
}
