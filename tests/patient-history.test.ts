import assert from "node:assert/strict";
import { test } from "node:test";
import {
  historyParams,
  isUpcoming,
  parseHistoryQuery,
  patientHistoryHref,
  splitByTiming,
} from "../src/lib/patient-history";

const now = new Date("2026-09-29T15:00:00.000Z");
const at = (iso: string) => new Date(iso);

test("próximo es un turno Programado que todavía no empezó", () => {
  assert.equal(
    isUpcoming({ status: "SCHEDULED", startsAt: at("2026-09-30T12:00Z") }, now),
    true,
  );
  // Programado sin cerrar cuya hora ya pasó: va con los pasados.
  assert.equal(
    isUpcoming({ status: "SCHEDULED", startsAt: at("2026-09-28T12:00Z") }, now),
    false,
  );
  assert.equal(isUpcoming({ status: "SCHEDULED", startsAt: now }, now), false);
  // Un cancelado a futuro no es próximo.
  assert.equal(
    isUpcoming({ status: "CANCELLED", startsAt: at("2026-10-05T12:00Z") }, now),
    false,
  );
});

test("la página se separa en próximos y pasados sin perder el orden", () => {
  const items = [
    { id: 4, status: "SCHEDULED" as const, startsAt: at("2026-10-10T12:00Z") },
    { id: 3, status: "CANCELLED" as const, startsAt: at("2026-10-05T12:00Z") },
    { id: 2, status: "SCHEDULED" as const, startsAt: at("2026-10-01T12:00Z") },
    { id: 1, status: "COMPLETED" as const, startsAt: at("2026-09-01T12:00Z") },
  ];
  const { upcoming, past } = splitByTiming(items, now);
  assert.deepEqual(
    upcoming.map((item) => item.id),
    [4, 2],
  );
  assert.deepEqual(
    past.map((item) => item.id),
    [3, 1],
  );
});

test("los filtros de la URL ignoran valores inválidos", () => {
  assert.deepEqual(
    parseHistoryQuery({ status: "EXPIRED", professionalId: "7", page: "2" }),
    { status: "EXPIRED", professionalId: 7, page: 2 },
  );
  assert.deepEqual(
    parseHistoryQuery({ status: "expired", professionalId: "0", page: "x" }),
    { status: undefined, professionalId: undefined, page: 1 },
  );
  assert.deepEqual(
    parseHistoryQuery({ status: ["COMPLETED"], professionalId: "-3" }),
    { status: undefined, professionalId: undefined, page: 1 },
  );
});

test("los filtros vigentes viajan en los links y el ancla lleva a la sección", () => {
  assert.deepEqual(historyParams({ status: "COMPLETED", page: 3 }), {
    status: "COMPLETED",
    professionalId: undefined,
  });
  assert.deepEqual(historyParams({ professionalId: 5, page: 1 }), {
    status: undefined,
    professionalId: "5",
  });
  assert.equal(patientHistoryHref(12), "/patients/12#historial");
});
