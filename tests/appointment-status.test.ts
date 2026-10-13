import assert from "node:assert/strict";
import { test } from "node:test";
import { AppointmentStatus } from "../src/generated/prisma/enums";
import {
  APPOINTMENT_STATUS_BADGE_CLASS,
  APPOINTMENT_STATUS_BORDER_CLASS,
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_ROW_CLASS,
  occupiesSlot,
} from "../src/lib/appointment-status";

test("todos los estados tienen clase de fondo de fila definida en APPOINTMENT_STATUS_ROW_CLASS", () => {
  const statuses = Object.values(AppointmentStatus);
  for (const status of statuses) {
    const rowClass = APPOINTMENT_STATUS_ROW_CLASS[status];
    assert.ok(rowClass, `Falta row class para estado ${status}`);
    assert.ok(
      rowClass.includes("hover:"),
      `El estado ${status} debe incluir clase de hover`,
    );
  }

  assert.ok(
    APPOINTMENT_STATUS_ROW_CLASS.SCHEDULED.includes("bg-scheduled-soft"),
  );
  assert.ok(APPOINTMENT_STATUS_ROW_CLASS.COMPLETED.includes("bg-success-soft"));
  assert.ok(APPOINTMENT_STATUS_ROW_CLASS.CANCELLED.includes("bg-muted"));
  assert.ok(APPOINTMENT_STATUS_ROW_CLASS.EXPIRED.includes("bg-warning-soft"));
});

test("todos los estados tienen clase de borde izquierdo definida en APPOINTMENT_STATUS_BORDER_CLASS", () => {
  const statuses = Object.values(AppointmentStatus);
  for (const status of statuses) {
    const borderClass = APPOINTMENT_STATUS_BORDER_CLASS[status];
    assert.ok(borderClass, `Falta border class para estado ${status}`);
    assert.ok(
      borderClass.startsWith("border-l-"),
      `El estado ${status} debe tener borde izquierdo border-l-*`,
    );
  }

  assert.equal(APPOINTMENT_STATUS_BORDER_CLASS.SCHEDULED, "border-l-scheduled");
  assert.equal(APPOINTMENT_STATUS_BORDER_CLASS.COMPLETED, "border-l-success");
  assert.equal(
    APPOINTMENT_STATUS_BORDER_CLASS.CANCELLED,
    "border-l-placeholder",
  );
  assert.equal(APPOINTMENT_STATUS_BORDER_CLASS.EXPIRED, "border-l-warning");
});

test("occupiesSlot identifica qué turnos ocupan la agenda y cuáles la liberan", () => {
  assert.equal(occupiesSlot(AppointmentStatus.SCHEDULED), true);
  assert.equal(occupiesSlot(AppointmentStatus.COMPLETED), true);
  assert.equal(occupiesSlot(AppointmentStatus.CANCELLED), false);
  assert.equal(occupiesSlot(AppointmentStatus.EXPIRED), false);
});

test("todos los estados tienen clase de badge definida en APPOINTMENT_STATUS_BADGE_CLASS", () => {
  const statuses = Object.values(AppointmentStatus);
  for (const status of statuses) {
    const badgeClass = APPOINTMENT_STATUS_BADGE_CLASS[status];
    assert.ok(badgeClass, `Falta badge class para estado ${status}`);
    assert.ok(
      badgeClass.includes("text-"),
      `El estado ${status} debe tener color de texto`,
    );
  }
});

test("todos los estados tienen etiqueta legible en APPOINTMENT_STATUS_LABEL", () => {
  assert.equal(APPOINTMENT_STATUS_LABEL.SCHEDULED, "Programado");
  assert.equal(APPOINTMENT_STATUS_LABEL.COMPLETED, "Completado");
  assert.equal(APPOINTMENT_STATUS_LABEL.CANCELLED, "Cancelado");
  assert.equal(APPOINTMENT_STATUS_LABEL.EXPIRED, "Vencido");
});
