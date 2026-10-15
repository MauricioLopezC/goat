import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEncounterSchema,
  updateEncounterSchema,
} from "../src/lib/validation/encounters";
import {
  encounterEditDeadline,
  isEncounterEditable,
} from "../src/lib/encounters";
import { toLocalSlot } from "../src/lib/schedule";

test("createEncounterSchema valida correctamente datos válidos", () => {
  const result = createEncounterSchema.safeParse({
    appointmentId: 42,
    notes: "  Paciente presenta cefalea tensional recurrente.  ",
    indications: "  Reposo 24hs e ibuprofeno 400mg cada 8hs.  ",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.appointmentId, 42);
    assert.equal(
      result.data.notes,
      "Paciente presenta cefalea tensional recurrente.",
    );
    assert.equal(
      result.data.indications,
      "Reposo 24hs e ibuprofeno 400mg cada 8hs.",
    );
  }
});

test("createEncounterSchema permite indicaciones vacías u omitidas", () => {
  const withoutIndications = createEncounterSchema.safeParse({
    appointmentId: 10,
    notes: "Control de rutina sin particularidades.",
  });
  assert.equal(withoutIndications.success, true);
  if (withoutIndications.success) {
    assert.equal(withoutIndications.data.indications, null);
  }

  const withEmptyIndications = createEncounterSchema.safeParse({
    appointmentId: 10,
    notes: "Control de rutina.",
    indications: "   ",
  });
  assert.equal(withEmptyIndications.success, true);
  if (withEmptyIndications.success) {
    assert.equal(withEmptyIndications.data.indications, null);
  }
});

test("createEncounterSchema rechaza notas vacías o con solo espacios", () => {
  for (const emptyNotes of ["", "   ", "\n\t  "]) {
    const result = createEncounterSchema.safeParse({
      appointmentId: 5,
      notes: emptyNotes,
    });
    assert.equal(result.success, false);
  }
});

test("createEncounterSchema rechaza appointmentId inválido", () => {
  for (const invalidId of [0, -1, 3.14, "42"]) {
    const result = createEncounterSchema.safeParse({
      appointmentId: invalidId,
      notes: "Notas válidas",
    });
    assert.equal(result.success, false);
  }
});

test("createEncounterSchema rechaza notas que excedan 5000 caracteres", () => {
  const longNotes = "a".repeat(5001);
  const result = createEncounterSchema.safeParse({
    appointmentId: 1,
    notes: longNotes,
  });
  assert.equal(result.success, false);
});

test("updateEncounterSchema valida correctamente datos válidos", () => {
  const result = updateEncounterSchema.safeParse({
    encounterId: 15,
    notes: "Corrección de diagnóstico: migraña con aura.",
    indications: "Derivación a neurología.",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.encounterId, 15);
    assert.equal(
      result.data.notes,
      "Corrección de diagnóstico: migraña con aura.",
    );
    assert.equal(result.data.indications, "Derivación a neurología.");
  }
});

test("updateEncounterSchema rechaza encounterId inválido y notas vacías", () => {
  const invalidId = updateEncounterSchema.safeParse({
    encounterId: 0,
    notes: "Notas válidas",
  });
  assert.equal(invalidId.success, false);

  const emptyNotes = updateEncounterSchema.safeParse({
    encounterId: 1,
    notes: "   ",
  });
  assert.equal(emptyNotes.success, false);
});

test("encounterEditDeadline calcula el límite exacto al fin del día siguiente al turno", () => {
  // Turno el 15 de Octubre de 2026 a las 10:30 (Argentina UTC-3)
  const appointmentTime = new Date("2026-10-15T10:30:00-03:00");
  const deadline = encounterEditDeadline(appointmentTime);

  // El fin del día siguiente (16 de Octubre) es 17 de Octubre 00:00:00 en UTC-3
  const deadlineSlot = toLocalSlot(deadline);
  assert.equal(deadlineSlot.date, "2026-10-17");
  assert.equal(deadlineSlot.minute, 0);

  // En milisegundos exactos coincide con 2026-10-17T00:00:00-03:00
  const expected = new Date("2026-10-17T00:00:00-03:00").getTime();
  assert.equal(deadline.getTime(), expected);
});

test("isEncounterEditable valida vigencia según plazo de fin del día siguiente", () => {
  const appointmentStartsAt = new Date("2026-10-15T10:30:00-03:00");

  // El mismo día del turno
  assert.equal(
    isEncounterEditable(
      appointmentStartsAt,
      new Date("2026-10-15T11:00:00-03:00"),
    ),
    true,
  );

  // Al día siguiente por la mañana
  assert.equal(
    isEncounterEditable(
      appointmentStartsAt,
      new Date("2026-10-16T09:00:00-03:00"),
    ),
    true,
  );

  // Al día siguiente a las 23:59:59 (último segundo antes del vencimiento)
  assert.equal(
    isEncounterEditable(
      appointmentStartsAt,
      new Date("2026-10-16T23:59:59-03:00"),
    ),
    true,
  );

  // A las 00:00:00 de dos días después (vencido)
  assert.equal(
    isEncounterEditable(
      appointmentStartsAt,
      new Date("2026-10-17T00:00:00-03:00"),
    ),
    false,
  );

  // Tres días después
  assert.equal(
    isEncounterEditable(
      appointmentStartsAt,
      new Date("2026-10-18T10:00:00-03:00"),
    ),
    false,
  );
});
