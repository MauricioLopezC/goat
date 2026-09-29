import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPatientDocumentChange,
  validatePatientClientForm,
} from "../src/lib/patients";
import {
  createPatientSchema,
  updatePatientSchema,
} from "../src/lib/validation/patients";

const stored = { documentType: "DNI", documentNumber: "35123456" } as const;

const editableData = {
  lastName: "Pérez",
  firstName: "Ana",
  gender: "FEMALE",
  birthDate: "1990-05-10",
  phone: "3874123456",
  email: "ana@example.com",
  coverageType: "PRIVATE",
} as const;

test("una modificación sin documento no lo cambia", () => {
  assert.equal(isPatientDocumentChange(stored, {}), false);
});

test("mandar el mismo documento no cuenta como cambio", () => {
  assert.equal(isPatientDocumentChange(stored, { ...stored }), false);
  assert.equal(
    isPatientDocumentChange(stored, { documentNumber: " 35123456 " }),
    false,
  );
});

test("cambiar el número o el tipo de documento se detecta", () => {
  assert.equal(
    isPatientDocumentChange(stored, { documentNumber: "35123457" }),
    true,
  );
  assert.equal(isPatientDocumentChange(stored, { documentType: "LE" }), true);
  assert.equal(
    isPatientDocumentChange(stored, {
      documentType: "PASSPORT",
      documentNumber: "AB123456",
    }),
    true,
  );
});

test("la edición no exige el documento", () => {
  const parsed = updatePatientSchema.safeParse({ id: 1, ...editableData });
  assert.equal(parsed.success, true);
});

test("la edición deja pasar el documento para que la DAL lo rechace", () => {
  const parsed = updatePatientSchema.safeParse({
    id: 1,
    ...editableData,
    documentType: "DNI",
    documentNumber: "99",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.documentNumber, "99");
});

test("el alta sigue exigiendo el documento con formato válido", () => {
  assert.equal(createPatientSchema.safeParse(editableData).success, false);
  assert.equal(
    createPatientSchema.safeParse({
      ...editableData,
      documentType: "DNI",
      documentNumber: "99",
    }).success,
    false,
  );
  assert.equal(
    createPatientSchema.safeParse({ ...editableData, ...stored }).success,
    true,
  );
});

test("el formulario de edición no valida el documento", () => {
  const { errors } = validatePatientClientForm({ ...editableData });
  assert.equal(errors.documentNumber, undefined);
});
