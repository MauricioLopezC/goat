import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAppointmentSchema,
  earliestSlotsSchema,
  updateAppointmentPrioritySchema,
} from "../src/lib/validation/appointments";

const baseAppointmentInput = {
  patientId: 1,
  professionalId: 1,
  serviceId: 1,
  date: "2026-10-15",
  startTime: "09:00",
  notes: "",
};

test("createAppointmentSchema asigna prioridad NORMAL por defecto", () => {
  const result = createAppointmentSchema.safeParse(baseAppointmentInput);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.priority, "NORMAL");
    assert.equal(result.data.priorityReason, undefined);
  }
});

test("createAppointmentSchema acepta prioridad NORMAL explícita sin motivo", () => {
  const result = createAppointmentSchema.safeParse({
    ...baseAppointmentInput,
    priority: "NORMAL",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.priority, "NORMAL");
  }
});

test("createAppointmentSchema acepta prioridad URGENT si incluye motivo", () => {
  const result = createAppointmentSchema.safeParse({
    ...baseAppointmentInput,
    priority: "URGENT",
    priorityReason: "Paciente con dolor agudo post-traumatismo",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.priority, "URGENT");
    assert.equal(
      result.data.priorityReason,
      "Paciente con dolor agudo post-traumatismo",
    );
  }
});

test("createAppointmentSchema rechaza prioridad URGENT sin motivo o con motivo vacío", () => {
  for (const emptyReason of [undefined, "", "   "]) {
    const result = createAppointmentSchema.safeParse({
      ...baseAppointmentInput,
      priority: "URGENT",
      priorityReason: emptyReason,
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("priorityReason"),
      );
      assert.ok(
        issue,
        "Debe reportar error en priorityReason cuando es URGENT y falta motivo",
      );
    }
  }
});

test("createAppointmentSchema rechaza motivo de urgencia excesivo", () => {
  const result = createAppointmentSchema.safeParse({
    ...baseAppointmentInput,
    priority: "URGENT",
    priorityReason: "a".repeat(501),
  });
  assert.equal(result.success, false);
});

test("createAppointmentSchema rechaza valores de prioridad no válidos", () => {
  const result = createAppointmentSchema.safeParse({
    ...baseAppointmentInput,
    priority: "EMERGENCY",
  });
  assert.equal(result.success, false);
});

test("updateAppointmentPrioritySchema valida transiciones a NORMAL y a URGENT", () => {
  const toNormal = updateAppointmentPrioritySchema.safeParse({
    appointmentId: 10,
    priority: "NORMAL",
  });
  assert.equal(toNormal.success, true);
  if (toNormal.success) {
    assert.equal(toNormal.data.priority, "NORMAL");
  }

  const toUrgent = updateAppointmentPrioritySchema.safeParse({
    appointmentId: 10,
    priority: "URGENT",
    reason: "Derivación urgente por fractura sospechada",
  });
  assert.equal(toUrgent.success, true);
  if (toUrgent.success) {
    assert.equal(toUrgent.data.priority, "URGENT");
    assert.equal(
      toUrgent.data.reason,
      "Derivación urgente por fractura sospechada",
    );
  }

  const toUrgentNoReason = updateAppointmentPrioritySchema.safeParse({
    appointmentId: 10,
    priority: "URGENT",
  });
  assert.equal(toUrgentNoReason.success, false);

  const invalidId = updateAppointmentPrioritySchema.safeParse({
    appointmentId: -1,
    priority: "NORMAL",
  });
  assert.equal(invalidId.success, false);
});

test("earliestSlotsSchema valida servicio, paciente y límite dentro de rango", () => {
  const defaultLimit = earliestSlotsSchema.safeParse({
    serviceId: 5,
    patientId: 2,
  });
  assert.equal(defaultLimit.success, true);
  if (defaultLimit.success) {
    assert.equal(defaultLimit.data.limit, 5);
  }

  const customLimit = earliestSlotsSchema.safeParse({
    serviceId: 5,
    patientId: 2,
    limit: 15,
  });
  assert.equal(customLimit.success, true);
  if (customLimit.success) {
    assert.equal(customLimit.data.limit, 15);
  }

  for (const bad of [
    { serviceId: -1, patientId: 2 },
    { serviceId: 0, patientId: 2 },
    { serviceId: 1.5, patientId: 2 },
    { serviceId: 1, patientId: -2 },
    { serviceId: 1, patientId: 2, limit: 0 },
    { serviceId: 1, patientId: 2, limit: 21 },
  ]) {
    assert.equal(earliestSlotsSchema.safeParse(bad).success, false);
  }
});
