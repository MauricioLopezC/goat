import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentInstant } from "../src/lib/appointment-slots";
import {
  calculateIndicators,
  currentPeriod,
  formatHours,
  formatPeriod,
  formatRate,
  periodBounds,
  periodDays,
  periodMonthCount,
  shiftMonthKey,
  sumIndicators,
  type ProfessionalIndicatorsInput,
} from "../src/lib/indicators";
import { centerIndicatorsSchema } from "../src/lib/validation/indicators";

// Octubre de 2026: el 1 es jueves. Franja de los jueves de 9 a 12 (180 min);
// hay cinco jueves (1, 8, 15, 22 y 29).
const now = new Date("2026-10-20T15:00:00Z");
const base: ProfessionalIndicatorsInput = {
  days: periodDays({ from: "2026-10", to: "2026-10" }),
  holidays: new Set(),
  windows: [{ weekday: "THURSDAY", startMinute: 540, endMinute: 720 }],
  exceptions: [],
  deactivatedOn: null,
  appointments: [],
  now,
};
const appointment = (
  date: string,
  startMinute: number,
  endMinute: number,
  status: ProfessionalIndicatorsInput["appointments"][number]["status"],
) => ({
  startsAt: appointmentInstant(date, startMinute),
  endsAt: appointmentInstant(date, endMinute),
  status,
});

test("el período abarca meses completos", () => {
  assert.deepEqual(periodBounds({ from: "2026-02", to: "2026-02" }), {
    first: "2026-02-01",
    last: "2026-02-28",
  });
  assert.deepEqual(periodBounds({ from: "2026-11", to: "2027-01" }), {
    first: "2026-11-01",
    last: "2027-01-31",
  });
  assert.equal(periodDays({ from: "2026-10", to: "2026-10" }).length, 31);
  assert.equal(periodMonthCount({ from: "2026-11", to: "2027-01" }), 3);
  assert.equal(periodMonthCount({ from: "2026-10", to: "2026-09" }), 0);
  assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
  assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
});

test("el período por defecto es el mes en curso en hora del centro", () => {
  // 1 de octubre a las 01:00 UTC todavía es 30 de septiembre en Salta.
  assert.deepEqual(currentPeriod(new Date("2026-10-01T01:00:00Z")), {
    from: "2026-09",
    to: "2026-09",
  });
  assert.equal(
    formatPeriod({ from: "2026-07", to: "2026-09" }),
    "julio de 2026 a septiembre de 2026",
  );
});

test("el schema rechaza períodos invertidos o de más de tres meses", () => {
  assert.ok(
    centerIndicatorsSchema.safeParse({ from: "2026-07", to: "2026-09" })
      .success,
  );
  assert.ok(
    !centerIndicatorsSchema.safeParse({ from: "2026-06", to: "2026-09" })
      .success,
  );
  assert.ok(
    !centerIndicatorsSchema.safeParse({ from: "2026-10", to: "2026-09" })
      .success,
  );
  assert.ok(
    !centerIndicatorsSchema.safeParse({ from: "2026-13", to: "2026-13" })
      .success,
  );
});

test("sin turnos, la ocupación es 0 y el ausentismo no tiene datos", () => {
  const result = calculateIndicators(base);
  assert.equal(result.availableMinutes, 5 * 180);
  assert.equal(result.occupancyRate, 0);
  assert.equal(result.absenteeismRate, null);
  assert.equal(formatRate(result.absenteeismRate), "Sin datos");
});

test("feriados, ausencias y la baja descuentan minutos disponibles", () => {
  const result = calculateIndicators({
    ...base,
    holidays: new Set(["2026-10-08"]),
    exceptions: [
      { date: "2026-10-15", startMinute: null, endMinute: null },
      { date: "2026-10-22", startMinute: 540, endMinute: 600 },
    ],
    // Desde el 29 ya no atiende.
    deactivatedOn: "2026-10-29",
  });
  // El 1 completo (180) y el 22 sin la primera hora (120).
  assert.equal(result.availableMinutes, 300);
});

test("la ocupación cuenta Programados y Completados dentro de la franja", () => {
  const result = calculateIndicators({
    ...base,
    appointments: [
      appointment("2026-10-01", 540, 600, "COMPLETED"),
      appointment("2026-10-29", 540, 570, "SCHEDULED"),
      // Mitad fuera de la franja: suma 30.
      appointment("2026-10-08", 690, 750, "SCHEDULED"),
      // No ocupan.
      appointment("2026-10-15", 540, 600, "CANCELLED"),
      appointment("2026-10-15", 600, 660, "EXPIRED"),
      // Un viernes, sin franja.
      appointment("2026-10-02", 540, 600, "COMPLETED"),
    ],
  });
  assert.equal(result.occupiedMinutes, 60 + 30 + 30);
  assert.equal(result.occupancyRate, 120 / 900);
});

test("un turno en un día cerrado cuenta para el ausentismo pero no ocupa", () => {
  const result = calculateIndicators({
    ...base,
    holidays: new Set(["2026-10-08"]),
    appointments: [appointment("2026-10-08", 540, 600, "EXPIRED")],
  });
  assert.equal(result.occupiedMinutes, 0);
  assert.equal(result.expired, 1);
  assert.equal(result.absenteeismRate, 1);
});

test("ausentismo, cancelaciones y turnos sin cerrar", () => {
  const result = calculateIndicators({
    ...base,
    appointments: [
      appointment("2026-10-01", 540, 570, "COMPLETED"),
      appointment("2026-10-01", 570, 600, "COMPLETED"),
      appointment("2026-10-01", 600, 630, "COMPLETED"),
      appointment("2026-10-08", 540, 570, "EXPIRED"),
      appointment("2026-10-08", 570, 600, "CANCELLED"),
      // Ya terminó y sigue Programado: sin cerrar.
      appointment("2026-10-15", 540, 570, "SCHEDULED"),
      // Futuro: Programado, pero no sin cerrar.
      appointment("2026-10-22", 540, 570, "SCHEDULED"),
    ],
  });
  assert.equal(result.completed, 3);
  assert.equal(result.expired, 1);
  assert.equal(result.absenteeismRate, 0.25);
  assert.equal(result.cancelled, 1);
  assert.equal(result.unclosed, 1);
});

test("el centro recalcula las tasas sobre las sumas", () => {
  const a = calculateIndicators({
    ...base,
    appointments: [appointment("2026-10-01", 540, 720, "COMPLETED")],
  });
  const b = calculateIndicators({
    ...base,
    windows: [{ weekday: "THURSDAY", startMinute: 540, endMinute: 1260 }],
    appointments: [appointment("2026-10-08", 540, 570, "EXPIRED")],
  });
  const center = sumIndicators([a, b]);
  assert.equal(center.availableMinutes, 900 + 3600);
  assert.equal(center.occupancyRate, 180 / 4500);
  assert.equal(center.absenteeismRate, 0.5);
  assert.deepEqual(sumIndicators([]).occupancyRate, null);
});

test("formatea horas y porcentajes", () => {
  assert.equal(formatHours(0), "0 h");
  assert.equal(formatHours(90), "1 h 30 min");
  assert.equal(formatHours(30), "30 min");
  assert.equal(formatRate(0.4249), "42 %");
});
