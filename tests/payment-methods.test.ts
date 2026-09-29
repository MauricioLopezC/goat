import assert from "node:assert/strict";
import { test } from "node:test";
import { PAYMENT_METHODS } from "../prisma/seed-data";
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
} from "../src/lib/validation/payment-method";
import { createServiceSchema } from "../src/lib/validation/service";
import { normalizeSearchText } from "../src/lib/services";

test("Invariantes del seed de medios de pago: 4 medios iniciales y todos activos (HU-20)", () => {
  assert.equal(
    PAYMENT_METHODS.length,
    4,
    "El seed debe tener exactamente 4 medios de pago",
  );

  const names = PAYMENT_METHODS.map((m) => m.name);
  assert.deepEqual(names, [
    "Efectivo",
    "Tarjeta de débito",
    "Tarjeta de crédito",
    "Transferencia",
  ]);

  for (const method of PAYMENT_METHODS) {
    assert.equal(
      method.active,
      true,
      `El medio de pago "${method.name}" debe sembrarse como activo`,
    );
  }
});

test("createPaymentMethodSchema valida nombre obligatorio y longitud máxima", () => {
  // Válido
  const valid = createPaymentMethodSchema.safeParse({ name: "Mercado Pago" });
  assert.ok(valid.success);
  assert.equal(valid.data.name, "Mercado Pago");

  // Espacios al inicio/fin se recortan
  const trimmed = createPaymentMethodSchema.safeParse({ name: "  Cheque  " });
  assert.ok(trimmed.success);
  assert.equal(trimmed.data.name, "Cheque");

  // Nombre vacío rechazado
  const empty = createPaymentMethodSchema.safeParse({ name: "   " });
  assert.equal(empty.success, false);

  // Nombre mayor a 80 caracteres rechazado
  const tooLong = createPaymentMethodSchema.safeParse({
    name: "A".repeat(81),
  });
  assert.equal(tooLong.success, false);
});

test("updatePaymentMethodSchema valida id, nombre y preprocesamiento de estado activo", () => {
  // Edición con activo booleano
  const res1 = updatePaymentMethodSchema.safeParse({
    id: "1",
    name: "Efectivo ARS",
    active: false,
  });
  assert.ok(res1.success);
  assert.equal(res1.data.id, 1);
  assert.equal(res1.data.name, "Efectivo ARS");
  assert.equal(res1.data.active, false);

  // Preprocesamiento de checkbox HTML ('on') y recorte de espacios
  const res2 = updatePaymentMethodSchema.safeParse({
    id: 2,
    name: "  Transferencia Bancaria  ",
    active: "on",
  });
  assert.ok(res2.success);
  assert.equal(res2.data.name, "Transferencia Bancaria");
  assert.equal(res2.data.active, true);

  // ID inválido
  const resInvalidId = updatePaymentMethodSchema.safeParse({
    id: "0",
    name: "Test",
    active: true,
  });
  assert.equal(resInvalidId.success, false);
});

test("createServiceSchema valida el campo price de HU-20", () => {
  const baseService = {
    name: "Consulta Traumatológica",
    durationMinutes: 30,
    requiresReferral: false,
  };

  // Precio válido con dos decimales
  const validPrice = createServiceSchema.safeParse({
    ...baseService,
    price: "1500.50",
  });
  assert.ok(validPrice.success);
  assert.equal(validPrice.data.price, 1500.5);

  // Precio cero permitido
  const zeroPrice = createServiceSchema.safeParse({
    ...baseService,
    price: 0,
  });
  assert.ok(zeroPrice.success);
  assert.equal(zeroPrice.data.price, 0);

  // Precio nulo o vacío se transforma a null
  const emptyPrice = createServiceSchema.safeParse({
    ...baseService,
    price: "",
  });
  assert.ok(emptyPrice.success);
  assert.equal(emptyPrice.data.price, null);

  const nullPrice = createServiceSchema.safeParse({
    ...baseService,
    price: null,
  });
  assert.ok(nullPrice.success);
  assert.equal(nullPrice.data.price, null);

  // Precio negativo rechazado
  const negativePrice = createServiceSchema.safeParse({
    ...baseService,
    price: "-10",
  });
  assert.equal(negativePrice.success, false);

  // Más de dos decimales rechazado
  const threeDecimals = createServiceSchema.safeParse({
    ...baseService,
    price: "10.555",
  });
  assert.equal(threeDecimals.success, false);
});

test("La comparación de medios de pago es insensible a mayúsculas, minúsculas y acentos", () => {
  // Efectivo vs efectivo vs EFECTIVO
  assert.equal(
    normalizeSearchText("efectivo"),
    normalizeSearchText("Efectivo"),
  );
  assert.equal(
    normalizeSearchText("EFECTIVO"),
    normalizeSearchText("Efectivo"),
  );

  // Tarjeta de debito vs Tarjeta de débito
  assert.equal(
    normalizeSearchText("tarjeta de debito"),
    normalizeSearchText("Tarjeta de débito"),
  );
  assert.equal(
    normalizeSearchText("TARJETA DE DEBITO"),
    normalizeSearchText("Tarjeta de débito"),
  );

  // Tarjeta de credito vs Tarjeta de crédito
  assert.equal(
    normalizeSearchText("Tarjeta de credito"),
    normalizeSearchText("Tarjeta de crédito"),
  );

  // Nombres distintos no deben coincidir
  assert.notEqual(
    normalizeSearchText("Transferencia bancaria"),
    normalizeSearchText("Transferencia"),
  );
});
