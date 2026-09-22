import "server-only";

import { hash, verify } from "@node-rs/argon2";

// argon2id (ADR 0002). Estas dos funciones son las que Better Auth aceptaría
// como `emailAndPassword.password.hash/verify` si alguna vez se migra, así que
// las contraseñas sobrevivirían a esa migración sin resetearse.
//
// `algorithm` no se pasa: argon2id ya es el default de @node-rs/argon2, y su
// enum es un `const enum` que no se puede importar con `isolatedModules`.
// Los parámetros quedan escritos dentro del hash, así que subirlos más adelante
// no invalida las contraseñas existentes.
const OPTIONS = {
  memoryCost: 19456, // 19 MiB, el mínimo que recomienda OWASP para argon2id
  timeCost: 2,
  parallelism: 1,
} as const;

/// Hash con sus parámetros incluidos, listo para guardar en `User.passwordHash`.
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plain, OPTIONS);
  } catch {
    // Un hash corrupto o con otro formato no es motivo para romper el login:
    // vale como credencial inválida.
    return false;
  }
}

// Hash real contra el que verificar cuando el email no existe, para que el
// tiempo de respuesta no delate qué emails están registrados (HU-01 pide el
// mismo error en los tres casos, y el mismo costo lo hace creíble).
//
// Se calcula una vez, la primera vez que hace falta, en vez de quedar escrito
// como constante: así no puede desincronizarse de OPTIONS.
let dummy: Promise<string> | undefined;

export function dummyHash(): Promise<string> {
  dummy ??= hashPassword("contraseña inexistente");
  return dummy;
}
