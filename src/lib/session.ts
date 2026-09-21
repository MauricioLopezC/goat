import "server-only";

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionPayload } from "@/lib/session-config";

// Único módulo que lee y escribe la cookie de sesión (ADR 0002). El resto del
// sistema pasa por `getSession()` y `requireRole()` de `src/lib/dal/auth.ts`.

export type { SessionPayload };

export async function readSession() {
  return getIronSession<SessionPayload>(await cookies(), sessionOptions());
}

export async function startSession(payload: SessionPayload) {
  const session = await readSession();
  session.userId = payload.userId;
  session.role = payload.role;
  await session.save();
}

export async function clearSession() {
  const session = await readSession();
  session.destroy();
}
