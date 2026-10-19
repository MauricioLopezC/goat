import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRateLimiter,
  extractClientIp,
  checkSignInRateLimit,
  signInRateLimiter,
  checkMutationRateLimit,
  mutationRateLimiter,
} from "../src/lib/rate-limit";

test("createRateLimiter permite solicitudes dentro del límite y bloquea al superarlo", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
  const t0 = 1_000_000;

  assert.deepEqual(limiter.check("user:1", t0), {
    rateLimited: false,
    remaining: 2,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.check("user:1", t0 + 1_000), {
    rateLimited: false,
    remaining: 1,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.check("user:1", t0 + 2_000), {
    rateLimited: false,
    remaining: 0,
    retryAfterSeconds: 0,
  });

  // Cuarto intento dentro de la ventana: bloqueado
  const blocked = limiter.check("user:1", t0 + 3_000);
  assert.equal(blocked.rateLimited, true);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterSeconds, 57);

  // Otra clave no se ve afectada
  assert.equal(limiter.check("user:2", t0 + 3_000).rateLimited, false);

  // Al expirar el primer intento de la ventana deslizante, vuelve a permitir
  const afterWindow = limiter.check("user:1", t0 + 60_001);
  assert.equal(afterWindow.rateLimited, false);
});

test("extractClientIp obtiene la IP real desde x-forwarded-for o x-real-ip", () => {
  const withForwarded = new Headers({
    "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    "x-real-ip": "10.0.0.2",
  });
  assert.equal(extractClientIp(withForwarded), "203.0.113.10");

  const withRealIp = new Headers({
    "x-real-ip": "198.51.100.7",
  });
  assert.equal(extractClientIp(withRealIp), "198.51.100.7");

  const empty = new Headers();
  assert.equal(extractClientIp(empty), "unknown");
});

test("checkSignInRateLimit y checkMutationRateLimit aplican límites independientes", () => {
  signInRateLimiter.reset();
  mutationRateLimiter.reset();

  const headers = new Headers({ "x-forwarded-for": "192.0.2.55" });
  const now = 2_000_000;

  for (let i = 0; i < 10; i++) {
    const res = checkSignInRateLimit(headers, "gerente@goat.local", now + i);
    assert.equal(res.rateLimited, false);
  }

  const eleventh = checkSignInRateLimit(
    headers,
    "gerente@goat.local",
    now + 20,
  );
  assert.equal(eleventh.rateLimited, true);

  // Mutaciones por actorId
  const mutationRes = checkMutationRateLimit(42, now);
  assert.equal(mutationRes.rateLimited, false);
  assert.equal(mutationRes.remaining, 59);

  signInRateLimiter.reset();
  mutationRateLimiter.reset();
});
