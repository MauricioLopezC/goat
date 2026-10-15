import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { Prisma } from "@/generated/prisma/client";

/// Transacción `Serializable` que se reintenta si PostgreSQL la aborta por un
/// conflicto con otra transacción concurrente (P2034). En el reintento se
/// vuelven a leer los datos, así el error que ve el usuario es el del estado
/// real (por ejemplo, "el turno ya fue cobrado").
///
/// Con el adapter `pg`, si el conflicto aparece al confirmar (COMMIT) y no en
/// una consulta, Prisma no lo traduce a P2034: llega como `DriverAdapterError`
/// con `cause.kind === "TransactionWriteConflict"`. Se reintenta igual.
///
/// Entre intentos espera un tiempo al azar: si varias transacciones chocan a la
/// vez, reintentar todas juntas las vuelve a hacer chocar.
const MAX_ATTEMPTS = 4;

export async function serializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  conflictMessage = "El turno cambió mientras confirmabas. Actualizá la página y volvé a intentar.",
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (isWriteConflict(error)) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 25 * attempt),
          );
          continue;
        }
        throw new DomainError("VALIDATION", conflictMessage);
      }
      throw error;
    }
  }
}

function isWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return error.code === "P2034";
  return (
    error instanceof Error &&
    error.name === "DriverAdapterError" &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "kind" in error.cause &&
    error.cause.kind === "TransactionWriteConflict"
  );
}
