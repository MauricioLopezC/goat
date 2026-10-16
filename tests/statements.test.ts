import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../src/generated/prisma/client";
import {
  calculateCommission,
  countDaysInclusive,
  defaultStatementPeriod,
  formatStatementPeriod,
  isFullMonth,
  CENTER_COMMISSION_PERCENTAGE,
  CENTER_COMMISSION_RATE,
} from "../src/lib/statements";
import { statementFilterSchema } from "../src/lib/validation/statements";

test("constantes de comisión del centro respetan el 15 %", () => {
  assert.equal(CENTER_COMMISSION_PERCENTAGE, 15);
  assert.equal(CENTER_COMMISSION_RATE, 0.15);
});

test("calculateCommission: calcula 15 % con redondeo al centavo y neto", () => {
  // Monto exacto entero
  const res10k = calculateCommission(10000);
  assert.equal(res10k.commission, "1500.00");
  assert.equal(res10k.net, "8500.00");

  const res15k = calculateCommission(15000);
  assert.equal(res15k.commission, "2250.00");
  assert.equal(res15k.net, "12750.00");

  // Redondeo de decimales: 1234.56 * 0.15 = 185.184 -> 185.18
  const resDec = calculateCommission("1234.56");
  assert.equal(resDec.commission, "185.18");
  assert.equal(resDec.net, "1049.38");

  // Redondeo hacia arriba: 99.99 * 0.15 = 14.9985 -> 15.00
  const resRoundUp = calculateCommission(99.99);
  assert.equal(resRoundUp.commission, "15.00");
  assert.equal(resRoundUp.net, "84.99");

  // Monto cero o negativo
  assert.deepEqual(calculateCommission(0), {
    commission: "0.00",
    net: "0.00",
  });
  assert.deepEqual(calculateCommission(-500), {
    commission: "0.00",
    net: "0.00",
  });

  // Prisma.Decimal
  const resPrisma = calculateCommission(new Prisma.Decimal(25000));
  assert.equal(resPrisma.commission, "3750.00");
  assert.equal(resPrisma.net, "21250.00");
});

test("defaultStatementPeriod: devuelve el mes en curso completo", () => {
  const period = defaultStatementPeriod(new Date("2026-10-15T12:00:00Z"));
  assert.equal(period.from, "2026-10-01");
  assert.equal(period.to, "2026-10-31");
  assert.equal(isFullMonth(period.from, period.to), true);
});

test("isFullMonth y formatStatementPeriod", () => {
  assert.equal(isFullMonth("2026-10-01", "2026-10-31"), true);
  assert.equal(isFullMonth("2026-02-01", "2026-02-28"), true);
  assert.equal(isFullMonth("2026-10-01", "2026-10-15"), false);
  assert.equal(isFullMonth("2026-10-05", "2026-10-31"), false);

  assert.equal(
    formatStatementPeriod("2026-10-01", "2026-10-31"),
    "Octubre de 2026",
  );
  assert.equal(
    formatStatementPeriod("2026-10-01", "2026-10-15"),
    "01/10/2026 al 15/10/2026",
  );
});

test("countDaysInclusive: calcula días de manera exacta", () => {
  assert.equal(countDaysInclusive("2026-10-01", "2026-10-01"), 1);
  assert.equal(countDaysInclusive("2026-10-01", "2026-10-31"), 31);
  assert.equal(countDaysInclusive("2026-08-01", "2026-10-31"), 92);
});

test("statementFilterSchema: valida entradas de período válidas", () => {
  const fullMonth = statementFilterSchema.safeParse({
    from: "2026-10-01",
    to: "2026-10-31",
  });
  assert.equal(fullMonth.success, true);

  const customRange = statementFilterSchema.safeParse({
    from: "2026-10-05",
    to: "2026-10-20",
    professionalId: 3,
  });
  assert.equal(customRange.success, true);
  if (customRange.success) {
    assert.equal(customRange.data.professionalId, 3);
  }

  // 3 meses calendario (agosto a octubre: 31 + 30 + 31 = 92 días)
  const threeMonths = statementFilterSchema.safeParse({
    from: "2026-08-01",
    to: "2026-10-31",
  });
  assert.equal(threeMonths.success, true);
});

test("statementFilterSchema: rechaza fechas inválidas, invertidas o superiores a 3 meses", () => {
  // Formato inválido
  const invalidFormat = statementFilterSchema.safeParse({
    from: "01/10/2026",
    to: "31/10/2026",
  });
  assert.equal(invalidFormat.success, false);

  // Fecha inexistente en el calendario
  const nonExistent = statementFilterSchema.safeParse({
    from: "2026-02-30",
    to: "2026-03-10",
  });
  assert.equal(nonExistent.success, false);

  // Fecha Desde posterior a Hasta
  const inverted = statementFilterSchema.safeParse({
    from: "2026-10-25",
    to: "2026-10-10",
  });
  assert.equal(inverted.success, false);

  // Rango mayor a 3 meses (enero a mayo = 121 días)
  const tooLong = statementFilterSchema.safeParse({
    from: "2026-01-01",
    to: "2026-05-01",
  });
  assert.equal(tooLong.success, false);

  // ProfessionalId no positivo
  const invalidProf = statementFilterSchema.safeParse({
    from: "2026-10-01",
    to: "2026-10-31",
    professionalId: -1,
  });
  assert.equal(invalidProf.success, false);
});
