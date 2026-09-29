import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { Prisma } from "@/generated/prisma/client";

/// Transacción `Serializable` que se reintenta si PostgreSQL la aborta por un
/// conflicto con otra transacción concurrente (P2034). En el reintento se
/// vuelven a leer los datos, así el error que ve el usuario es el del estado
/// real (por ejemplo, "el turno ya fue cobrado").
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        if (attempt < 3) continue;
        throw new DomainError("VALIDATION", conflictMessage);
      }
      throw error;
    }
  }
}
