import type { SessionOptions } from "iron-session";
import type { Role } from "@/generated/prisma/enums";

// Configuración de la cookie de sesión (ADR 0002), aparte de `session.ts`
// porque `proxy.ts` también la necesita y ahí no se puede importar
// `next/headers`. Este módulo no lee cookies: solo describe cómo se sellan.

/// Lo que viaja sellado en la cookie. El `role` está acá solo para el chequeo
/// optimista de `proxy.ts`; no es autoritativo. Toda decisión real de
/// autorización relee el usuario de la base en `getSession()`.
export type SessionPayload = {
  userId: number;
  role: Role;
};

/// Ocho horas: aproximadamente un turno de trabajo de mesa de entradas.
const TTL_SECONDS = 8 * 60 * 60;

export function sessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Falta SESSION_SECRET, o tiene menos de 32 caracteres. Ver .env.example.",
    );
  }

  return {
    cookieName: "goat_session",
    password: secret,
    ttl: TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}
