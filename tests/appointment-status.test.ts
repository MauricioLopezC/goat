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
import { cn } from "../src/lib/utils";
import { PAYMENT_STATE_LABEL, PAYMENT_STATES } from "../src/lib/payments";

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

test("APPOINTMENT_STATUS_BORDER_CLASS conserva border-l-* al combinarse con border-input en cn", () => {
  for (const status of Object.values(AppointmentStatus)) {
    const combined = cn(
      "border border-l-4",
      "z-19 border-input bg-muted text-muted-foreground line-through",
      APPOINTMENT_STATUS_BORDER_CLASS[status],
    );
    assert.ok(
      combined.includes(APPOINTMENT_STATUS_BORDER_CLASS[status]),
      `El estado ${status} debe conservar su clase ${APPOINTMENT_STATUS_BORDER_CLASS[status]}`,
    );
  }
});

test("el turno cancelado conserva border-l-placeholder en la combinación de clases de la agenda", () => {
  const weeklyClass = cn(
    "group absolute inset-x-0.5 flex items-center justify-between overflow-hidden rounded border border-l-4 px-1.5 py-0.5 text-left text-xs transition-all hover:scale-[1.01] hover:shadow-xs cursor-pointer",
    "z-19 border-input bg-muted text-muted-foreground line-through",
    APPOINTMENT_STATUS_BORDER_CLASS[AppointmentStatus.CANCELLED],
  );
  assert.ok(
    weeklyClass.includes("border-l-placeholder"),
    "La clase semanal debe conservar border-l-placeholder",
  );

  const dailyClass = cn(
    "absolute inset-x-1 z-25 flex flex-col justify-between rounded-md border border-l-4 p-1.5 text-xs shadow-xs",
    "bg-muted text-muted-foreground border-input line-through opacity-75",
    APPOINTMENT_STATUS_BORDER_CLASS[AppointmentStatus.CANCELLED],
  );
  assert.ok(
    dailyClass.includes("border-l-placeholder"),
    "La clase diaria debe conservar border-l-placeholder",
  );
});

test("todos los estados de pago en PAYMENT_STATES tienen etiqueta en PAYMENT_STATE_LABEL", () => {
  assert.equal(PAYMENT_STATES.length, 4);
  for (const state of PAYMENT_STATES) {
    const label = PAYMENT_STATE_LABEL[state];
    assert.ok(label, `Falta etiqueta para estado de pago ${state}`);
  }
  assert.equal(PAYMENT_STATE_LABEL.PAID, "Cobrado");
  assert.equal(PAYMENT_STATE_LABEL.PENDING_PAYMENT, "Pendiente de cobro");
  assert.equal(PAYMENT_STATE_LABEL.AUTHORIZED, "Autorizado");
  assert.equal(
    PAYMENT_STATE_LABEL.PENDING_AUTHORIZATION,
    "Pendiente de autorización",
  );
});

test("AppointmentLegend renderiza las cuatro variantes de pago cuando showPayments es true", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { AppointmentLegend } =
    await import("../src/components/appointment-legend");

  const html = renderToStaticMarkup(AppointmentLegend({ showPayments: true }));
  assert.ok(html.includes("Cobrado"), "Debe incluir Cobrado");
  assert.ok(
    html.includes("Pendiente de cobro"),
    "Debe incluir Pendiente de cobro",
  );
  assert.ok(html.includes("Autorizado"), "Debe incluir Autorizado");
  assert.ok(
    html.includes("Pendiente de autorización"),
    "Debe incluir Pendiente de autorización",
  );
  assert.ok(html.includes("Urgente"), "Debe incluir Urgente");
  assert.ok(
    html.includes("Atención registrada"),
    "Debe incluir Atención registrada",
  );
});

test("AppointmentLegend oculta pagos y permite alternar bloques libres y fuera de horario", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { AppointmentLegend } =
    await import("../src/components/appointment-legend");

  const monthHtml = renderToStaticMarkup(
    AppointmentLegend({
      showFreeBlocks: true,
      showOffHours: false,
      showPayments: false,
    }),
  );
  assert.ok(
    monthHtml.includes("Bloque libre"),
    "La vista mes debe incluir Bloque libre",
  );
  assert.ok(
    !monthHtml.includes("Fuera de horario"),
    "La vista mes no debe incluir Fuera de horario cuando showOffHours es false",
  );
  assert.ok(
    !monthHtml.includes("Cobrado"),
    "No debe incluir referencias de cobro si showPayments es false",
  );

  const dailyAgendaHtml = renderToStaticMarkup(
    AppointmentLegend({
      showFreeBlocks: false,
      showPayments: false,
    }),
  );
  assert.ok(
    !dailyAgendaHtml.includes("Bloque libre"),
    "No debe incluir Bloque libre cuando showFreeBlocks es false",
  );
});
