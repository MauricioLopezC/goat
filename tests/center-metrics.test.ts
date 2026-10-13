import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentInstant } from "../src/lib/appointment-slots";
import {
  calculateCenterMetrics,
  type CenterAppointment,
  type CenterPayment,
} from "../src/lib/center-metrics";

const period = { from: "2026-09", to: "2026-10" };

function appointment(
  day: string,
  patientId: number,
  status: CenterAppointment["status"],
  professionalId = 1,
  serviceId = 10,
): CenterAppointment {
  return {
    professionalId,
    patientId,
    serviceId,
    serviceName: serviceId === 10 ? "Rodilla" : "Columna",
    specialtyId: serviceId === 10 ? 1 : 2,
    specialtyName: serviceId === 10 ? "Traumatología" : "Kinesiología",
    startsAt: appointmentInstant(day, 600),
    endsAt: appointmentInstant(day, 660),
    status,
  };
}

function payment(
  day: string,
  amountCents: number,
  methodName = "Efectivo",
): CenterPayment {
  return { createdAt: appointmentInstant(day, 600), amountCents, methodName };
}

test("mide pacientes distintos y horas atendidas sin revelar identidades", () => {
  const result = calculateCenterMetrics(
    period,
    [
      appointment("2026-09-07", 101, "COMPLETED"),
      appointment("2026-09-08", 101, "COMPLETED"),
      appointment("2026-09-09", 102, "COMPLETED"),
      appointment("2026-09-10", 103, "CANCELLED"),
      appointment("2026-09-11", 104, "EXPIRED", 2, 20),
    ],
    [],
  );
  assert.equal(
    result.professionals.find((row) => row.id === 1)?.distinctPatients,
    2,
  );
  assert.equal(
    result.professionals.find((row) => row.id === 1)?.workedMinutes,
    180,
  );
  assert.equal(
    result.professionals.find((row) => row.id === 1)?.patientsPerHour,
    2 / 3,
  );
  assert.deepEqual(result.frequentPatients, [2, 1]);
  assert.equal(JSON.stringify(result).includes("101"), false);
  assert.equal(result.cancellationRate, 1 / 5);
  assert.equal(result.services[0].count, 4);
  assert.equal(result.days.find((day) => day.key === "MONDAY")?.count, 1);
});

test("compara cobros vigentes con los dos meses anteriores y agrupa por fecha de cobro", () => {
  const result = calculateCenterMetrics(
    period,
    [],
    [
      payment("2026-07-10", 5000),
      payment("2026-08-10", 5000),
      payment("2026-09-10", 15000),
      payment("2026-10-10", 5000, "Transferencia"),
    ],
  );
  assert.equal(result.income.totalCents, 20000);
  assert.equal(result.income.previousTotalCents, 10000);
  assert.equal(result.income.changeRate, 1);
  assert.deepEqual(result.income.months, [
    { month: "2026-09", cents: 15000 },
    { month: "2026-10", cents: 5000 },
  ]);
  assert.deepEqual(result.income.methods, [
    { name: "Efectivo", cents: 15000 },
    { name: "Transferencia", cents: 5000 },
  ]);
});

test("sin base para una tasa informa sin datos", () => {
  const result = calculateCenterMetrics(period, [], []);
  assert.equal(result.cancellationRate, null);
  assert.equal(result.income.changeRate, null);
  assert.deepEqual(result.frequentPatients, []);
  assert.deepEqual(result.services, []);
  assert.equal(result.income.months.length, 2);
});

test("sin cobros actuales pero con cobros previos la caída es del 100 %", () => {
  const result = calculateCenterMetrics(
    period,
    [],
    [payment("2026-08-10", 5000)],
  );
  assert.equal(result.income.totalCents, 0);
  assert.equal(result.income.previousTotalCents, 5000);
  assert.equal(result.income.changeRate, -1);
});
