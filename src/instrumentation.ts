import { assertValidEnv } from "@/lib/env";

// Next corre `register` una vez al iniciar el servidor, antes de atender
// requests. Validar acá hace que un `.env` roto falle al arrancar y con un
// mensaje que dice qué arreglar.
export function register() {
  assertValidEnv();
}
