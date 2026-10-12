import assert from "node:assert/strict";
import { test } from "node:test";
import { closeCashSchema } from "../src/lib/validation/cash";
import { normalizeSearchText } from "../src/lib/services";

test("closeCashSchema: entrada válida sin observaciones", () => {
  const result = closeCashSchema.safeParse({
    date: "2026-10-11",
    countedCashAmount: 15000,
  });
  assert.ok(result.success);
  assert.equal(result.data.date, "2026-10-11");
  assert.equal(result.data.countedCashAmount, 15000);
  assert.equal(result.data.notes, null);
});

test("closeCashSchema: entrada válida con observaciones y decimales", () => {
  const result = closeCashSchema.safeParse({
    date: "2026-10-11",
    countedCashAmount: "14500.50",
    notes: "Faltante de $499.50 por cambio no registrado",
  });
  assert.ok(result.success);
  assert.equal(result.data.countedCashAmount, 14500.5);
  assert.equal(
    result.data.notes,
    "Faltante de $499.50 por cambio no registrado",
  );
});

test("closeCashSchema: rechaza fecha con formato inválido o inexistente", () => {
  const invalidFormat = closeCashSchema.safeParse({
    date: "11-10-2026",
    countedCashAmount: 1000,
  });
  assert.equal(invalidFormat.success, false);

  const nonExistentDate = closeCashSchema.safeParse({
    date: "2026-02-30",
    countedCashAmount: 1000,
  });
  assert.equal(nonExistentDate.success, false);
});

test("closeCashSchema: rechaza monto negativo o con más de dos decimales", () => {
  const negative = closeCashSchema.safeParse({
    date: "2026-10-11",
    countedCashAmount: -50,
  });
  assert.equal(negative.success, false);

  const threeDecimals = closeCashSchema.safeParse({
    date: "2026-10-11",
    countedCashAmount: 123.456,
  });
  assert.equal(threeDecimals.success, false);
});

test("closeCashSchema: trunca y convierte observaciones vacías a null", () => {
  const emptyNotes = closeCashSchema.safeParse({
    date: "2026-10-11",
    countedCashAmount: 1000,
    notes: "   ",
  });
  assert.ok(emptyNotes.success);
  assert.equal(emptyNotes.data.notes, null);
});

test("normalización de medio de pago para identificar Efectivo", () => {
  const isCash = (name: string) => normalizeSearchText(name) === "efectivo";

  assert.equal(isCash("Efectivo"), true);
  assert.equal(isCash("EFECTIVO"), true);
  assert.equal(isCash("  efectivo  "), true);
  assert.equal(isCash("Tarjeta de débito"), false);
  assert.equal(isCash("Transferencia"), false);
});

test("cálculo de totales corregidos y diferencias con ajustes posteriores", () => {
  const originalTotal = 50000;
  const originalExpectedCash = 20000;
  const countedCash = 20000; // diferencia original 0

  const adjustments = [
    { amount: 15000, isCash: false },
    { amount: 5000, isCash: true },
  ];

  const deductedTotal = adjustments.reduce((acc, a) => acc + a.amount, 0);
  const deductedCash = adjustments
    .filter((a) => a.isCash)
    .reduce((acc, a) => acc + a.amount, 0);

  const correctedTotal = originalTotal - deductedTotal;
  const correctedExpectedCash = originalExpectedCash - deductedCash;
  const correctedDifference = countedCash - correctedExpectedCash;

  assert.equal(correctedTotal, 30000);
  assert.equal(correctedExpectedCash, 15000);
  // Como se anuló un cobro en efectivo posterior al cierre, el sistema ahora espera $15.000,
  // y como se habían contado $20.000, la diferencia corregida pasa a ser +$5.000 (sobrante)
  assert.equal(correctedDifference, 5000);
});
