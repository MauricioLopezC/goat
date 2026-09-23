import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appointmentDateBounds,
  appointmentInstant,
  calculateAvailableSlots,
} from "../src/lib/appointment-slots";
import { createAppointmentSchema } from "../src/lib/validation/appointments";

const base = {
  date: "2026-10-01",
  durationMinutes: 30,
  windows: [{ startMinute: 540, endMinute: 660 }],
  exceptions: [],
  appointments: [],
  holiday: false,
  now: new Date("2026-09-23T12:00:00Z"),
};

test("respeta duración variable y descarta bloques que no entran completos", () => {
  assert.deepEqual(calculateAvailableSlots({ ...base, durationMinutes: 45 }), [
    { startTime: "09:00", endTime: "09:45" },
    { startTime: "09:45", endTime: "10:30" },
  ]);
});
test("respeta varias franjas sin unir bloques a través de un descanso", () => {
  assert.deepEqual(
    calculateAvailableSlots({
      ...base,
      windows: [
        { startMinute: 540, endMinute: 570 },
        { startMinute: 600, endMinute: 630 },
      ],
    }).map((s) => s.startTime),
    ["09:00", "10:00"],
  );
});
test("un feriado o una ausencia de día completo elimina toda disponibilidad", () => {
  assert.deepEqual(calculateAvailableSlots({ ...base, holiday: true }), []);
  assert.deepEqual(
    calculateAvailableSlots({
      ...base,
      exceptions: [{ startMinute: null, endMinute: null }],
    }),
    [],
  );
});
test("ausencia parcial descarta cualquier bloque que la intersecte", () => {
  assert.deepEqual(
    calculateAvailableSlots({
      ...base,
      exceptions: [{ startMinute: 555, endMinute: 615 }],
    }).map((s) => s.startTime),
    ["10:30"],
  );
});
test("bloques ocupados excluyen solapamiento y permiten adyacencia exacta", () => {
  assert.deepEqual(
    calculateAvailableSlots({
      ...base,
      appointments: [
        {
          startsAt: appointmentInstant(base.date, 570),
          endsAt: appointmentInstant(base.date, 630),
        },
      ],
    }).map((s) => s.startTime),
    ["09:00", "10:30"],
  );
});
test("un turno que comenzó el día anterior también bloquea", () => {
  assert.deepEqual(
    calculateAvailableSlots({
      ...base,
      appointments: [
        {
          startsAt: new Date("2026-09-30T23:00:00-03:00"),
          endsAt: appointmentInstant(base.date, 570),
        },
      ],
    }).map((s) => s.startTime),
    ["09:30", "10:00", "10:30"],
  );
});
test("no ofrece horas pasadas ni el instante actual", () => {
  assert.deepEqual(
    calculateAvailableSlots({
      ...base,
      now: appointmentInstant(base.date, 600),
    }).map((s) => s.startTime),
    ["10:30"],
  );
});
test("dos meses se calculan por calendario y se acotan al último día del mes", () => {
  assert.deepEqual(appointmentDateBounds(new Date("2026-12-31T14:00:00Z")), {
    min: "2026-12-31",
    max: "2027-02-28",
  });
  assert.deepEqual(appointmentDateBounds(new Date("2026-09-23T01:00:00Z")), {
    min: "2026-09-22",
    max: "2026-11-22",
  });
});
test("fechas inválidas, IDs no válidos, horas y notas excesivas se rechazan", () => {
  const input = {
    patientId: 1,
    professionalId: 1,
    serviceId: 1,
    date: "2026-10-01",
    startTime: "09:00",
    notes: "",
  };
  assert.equal(createAppointmentSchema.safeParse(input).success, true);
  for (const change of [
    { date: "2026-02-30" },
    { patientId: -1 },
    { serviceId: 1.5 },
    { startTime: "24:00" },
    { notes: "a".repeat(501) },
  ])
    assert.equal(
      createAppointmentSchema.safeParse({ ...input, ...change }).success,
      false,
    );
});
