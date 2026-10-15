import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PORTAL_CANCELLATION_ADVANCE_MS,
  canPatientCancelAppointment,
  generateTemporaryPassword,
  hasMinimumCancellationNotice,
} from "../src/lib/portal";

test("hasMinimumCancellationNotice exige al menos 24 horas exactas de anticipación", () => {
  const now = new Date("2026-06-10T10:00:00.000Z");

  const exact24h = new Date(now.getTime() + PORTAL_CANCELLATION_ADVANCE_MS);
  assert.equal(hasMinimumCancellationNotice(exact24h, now), true);

  const moreThan24h = new Date(
    now.getTime() + PORTAL_CANCELLATION_ADVANCE_MS + 60_000,
  );
  assert.equal(hasMinimumCancellationNotice(moreThan24h, now), true);

  const lessThan24h = new Date(
    now.getTime() + PORTAL_CANCELLATION_ADVANCE_MS - 1,
  );
  assert.equal(hasMinimumCancellationNotice(lessThan24h, now), false);

  const inPast = new Date(now.getTime() - 3600_000);
  assert.equal(hasMinimumCancellationNotice(inPast, now), false);
});

test("canPatientCancelAppointment solo permite turnos SCHEDULED sin cobro vigente y con >= 24h", () => {
  const now = new Date("2026-06-10T10:00:00.000Z");
  const startsIn48h = new Date(
    now.getTime() + 2 * PORTAL_CANCELLATION_ADVANCE_MS,
  );
  const startsIn12h = new Date(
    now.getTime() + PORTAL_CANCELLATION_ADVANCE_MS / 2,
  );

  assert.equal(
    canPatientCancelAppointment(
      {
        status: "SCHEDULED",
        startsAt: startsIn48h,
        hasActivePayment: false,
      },
      now,
    ),
    true,
  );
  assert.equal(
    canPatientCancelAppointment(
      {
        status: "SCHEDULED",
        startsAt: startsIn48h,
        hasActivePayment: true,
      },
      now,
    ),
    false,
  );
  assert.equal(
    canPatientCancelAppointment(
      {
        status: "SCHEDULED",
        startsAt: startsIn12h,
        hasActivePayment: false,
      },
      now,
    ),
    false,
  );
  assert.equal(
    canPatientCancelAppointment(
      {
        status: "COMPLETED",
        startsAt: startsIn48h,
        hasActivePayment: false,
      },
      now,
    ),
    false,
  );
  assert.equal(
    canPatientCancelAppointment(
      {
        status: "CANCELLED",
        startsAt: startsIn48h,
        hasActivePayment: false,
      },
      now,
    ),
    false,
  );
  assert.equal(
    canPatientCancelAppointment(
      {
        status: "EXPIRED",
        startsAt: startsIn48h,
        hasActivePayment: false,
      },
      now,
    ),
    false,
  );
});

test("generateTemporaryPassword genera claves alfanuméricas sin caracteres ambiguos", () => {
  const pwd = generateTemporaryPassword(12);
  assert.equal(pwd.length, 12);
  assert.match(pwd, /^[A-HJ-NP-Za-km-z2-9]+$/);
});
