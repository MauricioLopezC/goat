// Rate limiting en memoria con ventana deslizante para proteger operaciones
// costosas (login con Argon2id) y mutaciones de Server Actions (estándar de
// Next.js 16 Data Security / Backend for Frontend).

export type RateLimitOptions = {
  /// Cantidad máxima de solicitudes permitidas dentro de `windowMs`.
  limit: number;
  /// Duración de la ventana deslizante en milisegundos.
  windowMs: number;
  /// Umbral de claves tras el cual se purgan las entradas vencidas.
  maxEntriesBeforeSweep?: number;
};

export type RateLimitResult = {
  rateLimited: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type HeaderReader = {
  get(name: string): string | null;
};

export function createRateLimiter(options: RateLimitOptions) {
  const { limit, windowMs, maxEntriesBeforeSweep = 1000 } = options;
  const hits = new Map<string, number[]>();

  function sweepExpired(now: number) {
    const cutoff = now - windowMs;
    for (const [key, timestamps] of hits.entries()) {
      const active = timestamps.filter((t) => t > cutoff);
      if (active.length === 0) {
        hits.delete(key);
      } else if (active.length !== timestamps.length) {
        hits.set(key, active);
      }
    }
  }

  function check(key: string, now: number = Date.now()): RateLimitResult {
    if (hits.size >= maxEntriesBeforeSweep) {
      sweepExpired(now);
    }

    const cutoff = now - windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= limit) {
      hits.set(key, recent);
      const oldestInWindow = recent[0] ?? now;
      const retryAfterMs = Math.max(1000, oldestInWindow + windowMs - now);
      return {
        rateLimited: true,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    recent.push(now);
    hits.set(key, recent);

    return {
      rateLimited: false,
      remaining: Math.max(0, limit - recent.length),
      retryAfterSeconds: 0,
    };
  }

  function reset(key?: string) {
    if (key !== undefined) {
      hits.delete(key);
    } else {
      hits.clear();
    }
  }

  return { check, reset };
}

/**
 * Obtiene la IP del cliente desde los headers del reverse proxy (Railway / Cloudflare).
 */
export function extractClientIp(headersList: HeaderReader): string {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = headersList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

/// Límite para login: 10 intentos cada 5 minutos por IP y por email.
export const signInRateLimiter = createRateLimiter({
  limit: 10,
  windowMs: 5 * 60 * 1000,
});

/// Límite para mutaciones autenticadas (Server Actions): 60 por minuto por usuario.
export const mutationRateLimiter = createRateLimiter({
  limit: 60,
  windowMs: 60 * 1000,
});

export function checkSignInRateLimit(
  headersList: HeaderReader,
  email: string,
  now: number = Date.now(),
): RateLimitResult {
  const ip = extractClientIp(headersList);
  const normalizedEmail = email.trim().toLowerCase();

  const byIp = signInRateLimiter.check(`ip:${ip}`, now);
  if (byIp.rateLimited) return byIp;

  return signInRateLimiter.check(`email:${normalizedEmail}`, now);
}

export function checkMutationRateLimit(
  actorId: number,
  now: number = Date.now(),
): RateLimitResult {
  return mutationRateLimiter.check(`actor:${actorId}`, now);
}
