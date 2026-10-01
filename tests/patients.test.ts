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

// ─────────────────────────────── HU-17 ───────────────────────────────

test("la edición acepta los campos nuevos de ficha completa (HU-17)", () => {
  const fullData = {
    id: 1,
    ...editableData,
    address: "Av. Belgrano 1234",
    city: "Salta",
    emergencyContactName: "Carlos Pérez",
    emergencyContactPhone: "3874998877",
    emergencyContactRelationship: "Padre",
    notes: "Paciente suele asistir acompañado por su padre.",
  };

  const parsed = updatePatientSchema.safeParse(fullData);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.address, "Av. Belgrano 1234");
  assert.equal(parsed.data?.city, "Salta");
  assert.equal(parsed.data?.emergencyContactName, "Carlos Pérez");
  assert.equal(parsed.data?.emergencyContactPhone, "3874998877");
  assert.equal(parsed.data?.emergencyContactRelationship, "Padre");
  assert.equal(
    parsed.data?.notes,
    "Paciente suele asistir acompañado por su padre.",
  );
});

test("regla cruzada: contacto de emergencia exige teléfono si se carga el nombre", () => {
  const parsed = updatePatientSchema.safeParse({
    id: 1,
    ...editableData,
    emergencyContactName: "Carlos Pérez",
  });

  assert.equal(parsed.success, false);
  const issues = parsed.error?.issues ?? [];
  assert.ok(
    issues.some(
      (i) =>
        i.path.includes("emergencyContactPhone") &&
        i.message.includes("El teléfono es obligatorio"),
    ),
  );
});

test("regla cruzada: contacto de emergencia exige nombre si se carga el teléfono", () => {
  const parsed = updatePatientSchema.safeParse({
    id: 1,
    ...editableData,
    emergencyContactPhone: "3874998877",
  });

  assert.equal(parsed.success, false);
  const issues = parsed.error?.issues ?? [];
  assert.ok(
    issues.some(
      (i) =>
        i.path.includes("emergencyContactName") &&
        i.message.includes("El nombre es obligatorio"),
    ),
  );
});

test("teléfono de emergencia debe tener formato válido", () => {
  const invalid = updatePatientSchema.safeParse({
    id: 1,
    ...editableData,
    emergencyContactName: "Carlos Pérez",
    emergencyContactPhone: "123", // Demasiado corto
  });

  assert.equal(invalid.success, false);
  assert.ok(
    invalid.error?.issues.some(
      (i) =>
        i.path.includes("emergencyContactPhone") &&
        i.message.includes(
          "El teléfono del contacto de emergencia debe contener",
        ),
    ),
  );

  const validWithPlus = updatePatientSchema.safeParse({
    id: 1,
    ...editableData,
    emergencyContactName: "Carlos Pérez",
    emergencyContactPhone: "+5493874112233",
  });

  assert.equal(validWithPlus.success, true);
});

test("el validador de cliente valida la regla cruzada y formato de contacto de emergencia", () => {
  const missingPhone = validatePatientClientForm({
    ...editableData,
    emergencyContactName: "Carlos Pérez",
  });
  assert.equal(missingPhone.isValid, false);
  assert.ok(
    missingPhone.errors.emergencyContactPhone?.includes(
      "El teléfono es obligatorio",
    ),
  );

  const missingName = validatePatientClientForm({
    ...editableData,
    emergencyContactPhone: "3874998877",
  });
  assert.equal(missingName.isValid, false);
  assert.ok(
    missingName.errors.emergencyContactName?.includes(
      "El nombre es obligatorio",
    ),
  );

  const invalidPhone = validatePatientClientForm({
    ...editableData,
    emergencyContactName: "Carlos Pérez",
    emergencyContactPhone: "telefono-invalido",
  });
  assert.equal(invalidPhone.isValid, false);
  assert.ok(
    invalidPhone.errors.emergencyContactPhone?.includes(
      "El teléfono del contacto de emergencia debe contener",
    ),
  );

  const validComplete = validatePatientClientForm({
    ...editableData,
    address: "Av. Belgrano 1234",
    city: "Salta",
    emergencyContactName: "Carlos Pérez",
    emergencyContactPhone: "+5493874112233",
    emergencyContactRelationship: "Padre",
    notes: "Anotación administrativa",
  });
  assert.equal(validComplete.isValid, true);
});
