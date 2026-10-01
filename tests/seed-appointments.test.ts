import assert from "node:assert/strict";
import { test } from "node:test";
import { AppointmentStatus } from "../src/generated/prisma/enums";
import { APPOINTMENTS, PATIENTS, PAYMENT_METHODS } from "../prisma/seed-data";
import { resolveSeedStatus, statusOncePast } from "../prisma/seed-status";

const { SCHEDULED, COMPLETED, CANCELLED, EXPIRED } = AppointmentStatus;

const now = new Date("2026-10-01T15:00:00Z");
const ended = new Date("2026-10-01T14:00:00Z");
const notEnded = new Date("2026-10-01T15:30:00Z");

test("resolveSeedStatus: un Programado de la semana actual que terminó toma su pastStatus", () => {
  assert.equal(
    resolveSeedStatus({ week: 0, status: SCHEDULED }, ended, now),
    COMPLETED,
  );
  assert.equal(
    resolveSeedStatus(
      { week: 0, status: SCHEDULED, pastStatus: EXPIRED },
      ended,
      now,
    ),
    EXPIRED,
  );
  assert.equal(
    resolveSeedStatus(
      { week: 0, status: SCHEDULED, pastStatus: SCHEDULED },
      ended,
      now,
    ),
    SCHEDULED,
  );
  // Termina justo ahora: ya se puede vencer.
  assert.equal(
    resolveSeedStatus(
      { week: 0, status: SCHEDULED, pastStatus: EXPIRED },
      now,
      now,
    ),
    EXPIRED,
  );
});

test("resolveSeedStatus: un turno futuro o en curso sigue Programado", () => {
  assert.equal(
    resolveSeedStatus({ week: 0, status: SCHEDULED }, notEnded, now),
    SCHEDULED,
  );
  assert.equal(
    resolveSeedStatus(
      { week: 0, status: SCHEDULED, pastStatus: EXPIRED },
      notEnded,
      now,
    ),
    SCHEDULED,
  );
});

test("resolveSeedStatus: fuera de la semana actual o si no es Programado, manda el estado declarado", () => {
  assert.equal(
    resolveSeedStatus({ week: -1, status: SCHEDULED }, ended, now),
    SCHEDULED,
  );
  assert.equal(
    resolveSeedStatus({ week: 0, status: CANCELLED }, ended, now),
    CANCELLED,
  );
  assert.equal(
    resolveSeedStatus({ week: -1, status: EXPIRED }, ended, now),
    EXPIRED,
  );
});

test("Invariantes del seed de turnos: pastStatus solo en Programados de la semana actual", () => {
  for (const a of APPOINTMENTS) {
    if (!a.pastStatus) continue;
    const label = `${a.professional} ${a.weekday} ${a.startTime}`;
    assert.equal(a.week, 0, `${label}: pastStatus fuera de la semana actual`);
    assert.equal(
      a.status,
      SCHEDULED,
      `${label}: pastStatus en un no Programado`,
    );
    assert.notEqual(a.pastStatus, CANCELLED, `${label}: pastStatus Cancelado`);
  }
});

test("Invariantes del seed de turnos: cobros solo en Completados de particulares con medio activo", () => {
  for (const a of APPOINTMENTS) {
    if (!a.payment) continue;
    const label = `${a.professional} ${a.weekday} ${a.startTime}`;
    const patient = PATIENTS.find((p) => p.documentNumber === a.patient);
    assert.equal(statusOncePast(a), COMPLETED, `${label}: cobro sin Completar`);
    assert.equal(patient?.coverage, null, `${label}: cobro con obra social`);
    assert.ok(
      PAYMENT_METHODS.some((m) => m.name === a.payment && m.active),
      `${label}: medio de pago "${a.payment}" inexistente o inactivo`,
    );
  }
});

test("Invariantes del seed de turnos: la semana actual deja Vencidos, pendientes y cobros pendientes", () => {
  const current = APPOINTMENTS.filter((a) => a.week === 0);
  const once = current.map((a) => statusOncePast(a));
  assert.equal(once.filter((s) => s === EXPIRED).length, 5);
  assert.equal(once.filter((s) => s === SCHEDULED).length, 2);

  const unpaid = current.filter(
    (a) =>
      statusOncePast(a) === COMPLETED &&
      !a.payment &&
      PATIENTS.find((p) => p.documentNumber === a.patient)?.coverage === null,
  );
  assert.ok(unpaid.length > 0, "Debe quedar algún Completado sin cobrar");
});
