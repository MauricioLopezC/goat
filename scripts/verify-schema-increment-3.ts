import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";

// Verifica SQL real en bases temporales propias, nunca sobre las tablas de GOAT.
// Requiere PostgreSQL local y permiso CREATEDB (igual que la shadow de Prisma).
async function main() {
  const source = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname));
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  const migrationName = "20261006120000_incremento_3";
  const migrations = (await readdir("prisma/migrations"))
    .filter((name) => /^\d+_/.test(name) && name <= migrationName)
    .sort();

  const fixture = `
INSERT INTO "User" ("email", "passwordHash", "lastName", "firstName", "role", "updatedAt")
VALUES ('schema-test@goat.local', 'fixture', 'Prueba', 'Schema', 'MANAGER', now());
INSERT INTO "Professional" ("lastName", "firstName", "documentType", "documentNumber", "licenseNumber", "createdById", "updatedAt")
VALUES ('Prueba', 'Profesional', 'DNI', '11111111', '123', 1, now());
INSERT INTO "Patient" ("lastName", "firstName", "gender", "documentType", "documentNumber", "birthDate", "phone", "email", "coverageType", "createdById", "updatedAt")
VALUES ('Prueba', 'Paciente', 'OTHER', 'DNI', '22222222', '1990-01-01', '123', 'patient@goat.local', 'PRIVATE', 1, now());
INSERT INTO "Service" ("name", "durationMinutes", "price", "updatedAt") VALUES ('Consulta', 30, 100, now());
INSERT INTO "Appointment" ("patientId", "professionalId", "serviceId", "startsAt", "endsAt", "status", "createdById", "updatedAt")
VALUES (1, 1, 1, '2026-09-01 12:00', '2026-09-01 12:30', 'COMPLETED', 1, now()),
       (1, 1, 1, '2026-09-02 12:00', '2026-09-02 12:30', 'COMPLETED', 1, now());
INSERT INTO "PaymentMethod" ("name", "updatedAt") VALUES ('Efectivo', now());
INSERT INTO "Payment" ("appointmentId", "paymentMethodId", "amount", "createdById", "createdAt")
VALUES (1, 1, 100, 1, '2026-09-02 12:00');
INSERT INTO "Payment" ("appointmentId", "paymentMethodId", "amount", "status", "createdById", "createdAt", "voidedById", "voidedAt", "voidReason")
VALUES (2, 1, 100, 'VOIDED', 1, '2026-09-01 12:00', 1, '2026-09-01 13:00', 'Prueba');
INSERT INTO "Holiday" ("date", "description", "createdById") VALUES ('2026-12-25', 'Feriado existente', 1);
INSERT INTO "AvailabilityException" ("professionalId", "date", "startMinute", "endMinute", "reason", "createdById")
VALUES (1, '2026-12-01', 480, 600, 'Ausencia existente', 1);
`;

  async function verifyPopulated(db: Client) {
    const preserved = await db.query(
      `SELECT "startDate"::text, "endDate"::text, "description", "createdById" FROM "Holiday"`,
    );
    assert.deepEqual(preserved.rows, [
      {
        startDate: "2026-12-25",
        endDate: "2026-12-25",
        description: "Feriado existente",
        createdById: 1,
      },
    ]);
    const absence = await db.query(
      `SELECT "startDate"::text, "endDate"::text, "startMinute", "endMinute" FROM "AvailabilityException"`,
    );
    assert.deepEqual(absence.rows, [
      {
        startDate: "2026-12-01",
        endDate: "2026-12-01",
        startMinute: 480,
        endMinute: 600,
      },
    ]);
    const receipts = await db.query(
      `SELECT "receiptNumber", "status", "cashClosingId" FROM "Payment" ORDER BY "id"`,
    );
    assert.deepEqual(receipts.rows, [
      { receiptNumber: 2, status: "PAID", cashClosingId: null },
      { receiptNumber: 1, status: "VOIDED", cashClosingId: null },
    ]);
    const users = await db.query(`SELECT "mustChangePassword" FROM "User"`);
    assert.equal(users.rows[0].mustChangePassword, false);
    const patients = await db.query(`SELECT "userId" FROM "Patient"`);
    assert.equal(patients.rows[0].userId, null);

    async function rejects(sql: string, constraint: string, code = "23514") {
      await assert.rejects(db.query(sql), { code, constraint });
    }
    const holiday = (from: string, to: string, start: string, end: string) =>
      `INSERT INTO "Holiday" ("startDate", "endDate", "startMinute", "endMinute", "description", "createdById") VALUES ('${from}', '${to}', ${start}, ${end}, 'Prueba', 1)`;
    await db.query(holiday("2027-01-01", "2027-01-03", "480", "720"));
    await db.query(holiday("2027-01-01", "2027-01-03", "720", "900"));
    await db.query(holiday("2027-01-04", "2027-01-04", "480", "720"));
    await rejects(
      holiday("2027-01-03", "2027-01-05", "600", "800"),
      "Holiday_no_overlap",
      "23P01",
    );
    await rejects(
      holiday("2027-01-02", "2027-01-02", "NULL", "NULL"),
      "Holiday_no_overlap",
      "23P01",
    );
    await rejects(
      holiday("2028-01-02", "2028-01-01", "NULL", "NULL"),
      "Holiday_dates_valid",
    );
    for (const [start, end] of [
      ["NULL", "600"],
      ["480", "NULL"],
      ["600", "600"],
      ["-1", "600"],
      ["480", "1441"],
    ]) {
      await rejects(
        holiday("2028-01-01", "2028-01-01", start, end),
        "Holiday_minutes_valid",
      );
    }
    const exception = (start: string, end: string, professionalId = 1) =>
      `INSERT INTO "AvailabilityException" ("professionalId", "startDate", "endDate", "startMinute", "endMinute", "reason", "createdById") VALUES (${professionalId}, '2026-12-01', '2026-12-03', ${start}, ${end}, 'Prueba', 1)`;
    await rejects(
      exception("500", "700"),
      "AvailabilityException_no_overlap",
      "23P01",
    );
    await rejects(
      exception("NULL", "NULL"),
      "AvailabilityException_no_overlap",
      "23P01",
    );
    await db.query(exception("600", "720"));
    await rejects(
      exception("NULL", "600"),
      "AvailabilityException_minutes_valid",
    );
    await rejects(
      exception("600", "NULL"),
      "AvailabilityException_minutes_valid",
    );
    await db.query(
      `INSERT INTO "Professional" ("lastName", "firstName", "documentType", "documentNumber", "licenseNumber", "createdById", "updatedAt") VALUES ('Otro', 'Profesional', 'DNI', '33333333', '124', 1, now())`,
    );
    await db.query(exception("480", "600", 2));

    const encounter = (notes: string) =>
      `INSERT INTO "Encounter" ("appointmentId", "professionalId", "notes", "updatedAt") VALUES (1, 1, '${notes}', now())`;
    await rejects(encounter("   "), "Encounter_notes_not_blank");
    await db.query(encounter("Atención registrada"));
    await rejects(
      encounter("Duplicada"),
      "Encounter_appointmentId_key",
      "23505",
    );

    const closing = (
      date: string,
      counted: number,
      difference: number,
      notes: string,
    ) =>
      `INSERT INTO "CashClosing" ("date", "paymentCount", "totalAmount", "expectedCashAmount", "countedCashAmount", "difference", "notes", "closedById") VALUES ('${date}', 1, 100, 100, ${counted}, ${difference}, ${notes}, 1)`;
    await rejects(
      closing("2026-09-02", 90, -10, "NULL"),
      "CashClosing_difference_has_notes",
    );
    await rejects(
      closing("2026-09-02", 90, -10, "' '"),
      "CashClosing_difference_has_notes",
    );
    await rejects(
      closing("2026-09-02", 90, 0, "NULL"),
      "CashClosing_difference_valid",
    );
    await rejects(
      closing("2026-09-02", -1, -101, "'Faltante'"),
      "CashClosing_amounts_valid",
    );
    const closed = await db.query(
      closing("2026-09-02", 90, -10, "'Faltante registrado'") +
        ' RETURNING "id"',
    );
    await rejects(
      closing("2026-09-02", 100, 0, "NULL"),
      "CashClosing_date_key",
      "23505",
    );
    await db.query(`UPDATE "Payment" SET "cashClosingId" = $1 WHERE "id" = 1`, [
      closed.rows[0].id,
    ]);
    await db.query(
      `UPDATE "Payment" SET "status" = 'VOIDED', "voidedAt" = now(), "voidedById" = 1, "voidReason" = 'Corrección posterior' WHERE "id" = 1`,
    );
    const snapshot = await db.query(
      `SELECT "totalAmount", "difference" FROM "CashClosing"`,
    );
    assert.deepEqual(snapshot.rows, [
      { totalAmount: "100.00", difference: "-10.00" },
    ]);
    const next = await db.query(
      `INSERT INTO "Payment" ("appointmentId", "paymentMethodId", "amount", "createdById") VALUES (1, 1, 100, 1) RETURNING "receiptNumber"`,
    );
    assert.equal(next.rows[0].receiptNumber, 3);
    await rejects(
      `UPDATE "Payment" SET "receiptNumber" = 1 WHERE "receiptNumber" = 3`,
      "Payment_receiptNumber_key",
      "23505",
    );
    await rejects(
      `UPDATE "Payment" SET "receiptNumber" = 0 WHERE "receiptNumber" = 3`,
      "Payment_receipt_number_positive",
    );

    await db.query(
      `INSERT INTO "User" ("email", "passwordHash", "lastName", "firstName", "role", "mustChangePassword", "updatedAt") VALUES ('portal@goat.local', 'fixture', 'Prueba', 'Portal', 'PATIENT', true, now())`,
    );
    await db.query(`UPDATE "Patient" SET "userId" = 2 WHERE "id" = 1`);
    await rejects(
      `INSERT INTO "Patient" ("lastName", "firstName", "gender", "documentType", "documentNumber", "birthDate", "phone", "email", "coverageType", "createdById", "updatedAt", "userId") VALUES ('Otra', 'Persona', 'OTHER', 'DNI', '44444444', '1990-01-01', '123', 'other@goat.local', 'PRIVATE', 1, now(), 2)`,
      "Patient_userId_key",
      "23505",
    );
    await rejects(
      `DELETE FROM "CashClosing" WHERE "id" = ${closed.rows[0].id}`,
      "Payment_cashClosingId_fkey",
      "23503",
    );
    console.log(
      "OK: migración con datos, límites y solapamientos, atención única, comprobantes, caja y portal.",
    );
  }

  await admin.connect();
  try {
    for (const populated of [false, true]) {
      const database = `goat_schema_test_${randomUUID().replaceAll("-", "")}`;
      assert.match(database, /^goat_schema_test_[a-f0-9]{32}$/);
      await admin.query(`CREATE DATABASE "${database}"`);
      const testUrl = new URL(source);
      testUrl.pathname = `/${database}`;
      const db = new Client({ connectionString: testUrl.toString() });
      try {
        await db.connect();
        for (const name of migrations) {
          if (name === migrationName && populated) await db.query(fixture);
          await db.query(
            await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"),
          );
        }
        if (populated) await verifyPopulated(db);
        else {
          const next = await db.query(
            `SELECT nextval('"Payment_receiptNumber_seq"')::int AS number`,
          );
          assert.equal(next.rows[0].number, 1);
          console.log(
            "OK: todas las migraciones desde una base vacía; comprobantes desde 1.",
          );
        }
      } finally {
        await db.end();
        // Únicamente la base temporal creada en esta iteración, nunca DATABASE_URL.
        await admin.query(`DROP DATABASE "${database}"`);
      }
    }
  } finally {
    await admin.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
