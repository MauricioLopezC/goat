import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { STAFF_ROLES } from "@/lib/roles";
import { readSession, startSession, clearSession } from "@/lib/session";
import { dummyHash, hashPassword, verifyPassword } from "@/lib/password";
import { DomainError } from "@/lib/actions";
import type { SignInInput, CreateUserInput } from "@/lib/validation/auth";

export { STAFF_ROLES };

// Único punto del sistema que sabe cómo está implementada la sesión (ADR 0001
// y ADR 0002). Todo lo demás llama a `getSession()` o a `requireRole()`.

/// Lo que el resto del código sabe del usuario autenticado. No incluye el
/// `passwordHash` ni nada que no deba viajar al cliente.
export type Actor = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
};

const ACTOR_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  active: true,
} as const;

/// Devuelve el usuario de la sesión, o `null` si no hay sesión, el usuario ya
/// no existe o fue dado de baja.
///
/// Relee `role` y `active` de la base en vez de confiar en la cookie: así una
/// baja o un cambio de rol tienen efecto en el próximo movimiento, sin esperar
/// a que la sesión expire. `cache()` hace que varios componentes del mismo
/// render compartan una sola consulta por clave primaria.
export const getSession = cache(async (): Promise<Actor | null> => {
  const session = await readSession();
  if (!session.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: ACTOR_FIELDS,
  });

  if (!user?.active) return null;

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  };
});

/// Exige sesión y uno de los roles indicados. Sin roles, alcanza con estar
/// autenticado.
///
/// Sin sesión redirige al login; con sesión pero sin permiso lanza `FORBIDDEN`,
/// que `defineAction` convierte en `ActionResult`.
export async function requireRole(...roles: Role[]): Promise<Actor> {
  const actor = await getSession();
  if (!actor) redirect("/login");

  if (roles.length > 0 && !roles.includes(actor.role)) {
    throw new DomainError(
      "FORBIDDEN",
      "No tenés permiso para realizar esta operación.",
    );
  }

  return actor;
}

/// Ruta inicial de cada rol al ingresar (HU-01).
export function landingPath(role: Role): string {
  switch (role) {
    case Role.RECEPTIONIST:
      return "/calendar";
    case Role.PROFESSIONAL:
      return "/agenda";
    case Role.MANAGER:
      return "/professionals";
    case Role.PATIENT:
      // El paciente no accede al sistema en el Inc. 1 y `createUser` no permite
      // ese rol. Devolver "/" haría un bucle, porque "/" manda acá.
      return "/login";
  }
}

/// Variante de `requireRole` para páginas.
///
/// `requireRole` lanza `DomainError`, que `defineAction` traduce a
/// `ActionResult`; en una página nadie lo atrapa y sale un error 500. Acá, en
/// cambio, al usuario se lo manda a su propia pantalla: escribir a mano la URL
/// de otro rol no es un error que valga una pantalla de error.
export async function requirePageRole(...roles: Role[]): Promise<Actor> {
  const actor = await getSession();
  if (!actor) redirect("/login");

  if (roles.length > 0 && !roles.includes(actor.role)) {
    redirect(landingPath(actor.role));
  }

  return actor;
}

/// Verifica las credenciales y abre la sesión. Devuelve a dónde ir.
///
/// Email inexistente, contraseña incorrecta y usuario inactivo devuelven el
/// mismo error, a propósito (HU-01): distinguirlos revelaría qué emails están
/// registrados. Por el mismo motivo siempre se verifica un hash, incluso
/// cuando el usuario no existe, para que el tiempo de respuesta no lo delate.
export async function signIn(input: SignInInput): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true, role: true, active: true },
  });

  const matches = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await dummyHash()),
  );

  if (!user || !user.active || !matches) {
    throw new DomainError(
      "INVALID_CREDENTIALS",
      "El email o la contraseña no son correctos.",
    );
  }

  await startSession({ userId: user.id, role: user.role });
  return landingPath(user.role);
}

export async function signOut(): Promise<void> {
  await clearSession();
}

/// Listado de usuarios del centro, para la pantalla del gerente.
///
/// Es una lectura: la consume un Server Component llamando directo a la DAL
/// (ADR 0001). Devuelve solo lo que la pantalla muestra, nunca el
/// `passwordHash`.
export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
}

/// Alta de usuario. Solo el gerente (el rol lo verifica la acción).
export async function createUser(input: CreateUserInput): Promise<Actor> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw new DomainError(
      "EMAIL_TAKEN",
      "Ya existe un usuario con ese email.",
      {
        email: ["Ya existe un usuario con ese email"],
      },
    );
  }

  const { password, ...rest } = input;

  return prisma.user.create({
    data: { ...rest, passwordHash: await hashPassword(password) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  });
}
