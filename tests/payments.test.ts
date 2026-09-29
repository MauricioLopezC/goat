import assert from "node:assert/strict";
import { test } from "node:test";
import { isChargeable, paymentState } from "../src/lib/payments";
import {
  registerAuthorizationSchema,
  registerPaymentSchema,
  voidPaymentSchema,
} from "../src/lib/validation/payments";

const base = {
  coverageType: "PRIVATE" as const,
  requiresReferral: false,
  hasActivePayment: false,
  authorizationNumber: null,
};

test("Particular: pendiente de cobro o cobrado, requiera orden o no (HU-21)", () => {
  assert.equal(paymentState(base), "PENDING_PAYMENT");
  assert.equal(paymentState({ ...base, hasActivePayment: true }), "PAID");
  assert.equal(
    paymentState({ ...base, requiresReferral: true }),
    "PENDING_PAYMENT",
  );
});

test("Obra social: autorización solo si el servicio requiere orden (HU-21)", () => {
  const insured = { ...base, coverageType: "HEALTH_INSURANCE" as const };
  assert.equal(paymentState(insured), null);
  assert.equal(
    paymentState({ ...insured, requiresReferral: true }),
    "PENDING_AUTHORIZATION",
  );
  assert.equal(
    paymentState({
      ...insured,
      requiresReferral: true,
      authorizationNumber: "A-123",
    }),
    "AUTHORIZED",
  );
  // A un paciente con obra social no se le cobra en el Inc. 2.
  assert.equal(paymentState({ ...insured, hasActivePayment: true }), null);
});

test("Se cobra un turno Programado de hoy, en hora de Argentina, o uno Completado (HU-21)", () => {
  // 29/09 a las 23:30 en Argentina (UTC-3) es 30/09 02:30 UTC.
  const now = new Date("2026-09-30T02:30:00Z");
  const todayMorning = new Date("2026-09-29T12:00:00Z");
  const tomorrow = new Date("2026-09-30T12:00:00Z");
  const yesterday = new Date("2026-09-28T12:00:00Z");

  assert.equal(
    isChargeable({ status: "SCHEDULED", startsAt: todayMorning }, now),
    true,
  );
  assert.equal(
    isChargeable({ status: "SCHEDULED", startsAt: tomorrow }, now),
    false,
  );
  assert.equal(
    isChargeable({ status: "SCHEDULED", startsAt: yesterday }, now),
    false,
  );
  assert.equal(
    isChargeable({ status: "COMPLETED", startsAt: yesterday }, now),
    true,
  );
  assert.equal(
    isChargeable({ status: "CANCELLED", startsAt: todayMorning }, now),
    false,
  );
  assert.equal(
    isChargeable({ status: "EXPIRED", startsAt: todayMorning }, now),
    false,
  );
});

test("Validación de cobro, anulación y autorización (HU-21)", () => {
  assert.equal(
    registerPaymentSchema.safeParse({ appointmentId: 1, paymentMethodId: 2 })
      .success,
    true,
  );
  assert.equal(
    registerPaymentSchema.safeParse({ appointmentId: 1 }).success,
    false,
  );
  assert.equal(
    voidPaymentSchema.parse({ paymentId: 1, reason: "  mal cargado  " }).reason,
    "mal cargado",
  );
  assert.equal(
    registerAuthorizationSchema.safeParse({
      appointmentId: 1,
      authorizationNumber: "   ",
    }).success,
    false,
  );
  assert.equal(
    registerAuthorizationSchema.safeParse({
      appointmentId: 1,
      authorizationNumber: "x".repeat(51),
    }).success,
    false,
  );
});
