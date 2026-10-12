import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";

// Prueba el seed completo en una base temporal y la elimina al terminar.
async function main(withClosedDays: boolean) {
  const source = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname));
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  const database = `goat_seed_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(database, /^goat_seed_test_[a-f0-9]{32}$/);
  const testUrl = new URL(source);
  testUrl.pathname = `/${database}`;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    const db = new Client({ connectionString: testUrl.toString() });
    try {
      await db.connect();
      const migrations = (await readdir("prisma/migrations"))
        .filter((name) => /^\d+_/.test(name))
        .sort();
      for (const migration of migrations) {
        await db.query(
          await readFile(
            `prisma/migrations/${migration}/migration.sql`,
            "utf8",
          ),
        );
      }

      // Miércoles hábil a las 17:00 de Argentina: ejercita cobros del seed
      // anterior y la fase de estados de hoy, aunque la prueba corra un domingo.
      const clockImport =
        "data:text/javascript," +
        encodeURIComponent(
          "import { mock } from 'node:test'; mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-14T20:00:00Z') });",
        );
      const protectedDates = ["2026-10-07", "2026-10-14"];
      if (withClosedDays) {
        const user = await db.query(
          `INSERT INTO "User" (email, "passwordHash", "firstName", "lastName", role, "updatedAt")
           VALUES ('closed-days@seed-test.invalid', 'disabled-login', 'Prueba', 'Caja', 'MANAGER', now()) RETURNING id`,
        );
        for (const date of protectedDates) {
          await db.query(
            `INSERT INTO "CashClosing" (date, "paymentCount", "totalAmount", "expectedCashAmount", "countedCashAmount", difference, "closedById", "closedAt", notes)
             VALUES ($1::date, 0, 0, 0, 0, 0, $2, $1::date + interval '19 hours', 'Cierre existente: conservar')`,
            [date, user.rows[0].id],
          );
        }
      }
      const preservedClosings = await db.query(
        'SELECT * FROM "CashClosing" ORDER BY id',
      );

      async function verifyClosedDays() {
        for (const date of protectedDates) {
          const rows = await db.query(
            `SELECT
              (SELECT count(*)::int FROM "Appointment" WHERE "startsAt" >= $1::date + interval '3 hours' AND "startsAt" < $1::date + interval '27 hours') AS appointments,
              (SELECT count(*)::int FROM "Payment" WHERE "createdAt" >= $1::date + interval '3 hours' AND "createdAt" < $1::date + interval '27 hours') AS payments`,
            [date],
          );
          if (withClosedDays) {
            assert.deepEqual(
              rows.rows[0],
              { appointments: 0, payments: 0 },
              `El seed agregó datos al día cerrado ${date}`,
            );
          } else {
            assert.ok(
              rows.rows[0].appointments > 0,
              `El control no generó turnos el ${date}`,
            );
            assert.ok(
              rows.rows[0].payments > 0,
              `El control no generó cobros el ${date}`,
            );
          }
        }
        if (withClosedDays) {
          const after = await db.query(
            'SELECT * FROM "CashClosing" WHERE date = ANY($1::date[]) ORDER BY id',
            [protectedDates],
          );
          assert.deepEqual(
            after.rows,
            preservedClosings.rows,
            "Se modificó una caja preexistente",
          );
        }
      }

      function runSeed() {
        const output = execFileSync(
          process.execPath,
          ["--import", clockImport, "--import", "tsx", "prisma/seed.ts"],
          {
            env: { ...process.env, DATABASE_URL: testUrl.toString() },
            encoding: "utf8",
            timeout: 120_000,
          },
        );
        console.log(
          output.split("\n").filter((line) => line.includes("Demo:"))[0],
        );
      }

      const counts = async () => {
        const result = await db.query(`
          SELECT
            (SELECT count(*)::int FROM "Appointment") AS appointments,
            (SELECT count(*)::int FROM "Payment") AS payments,
            (SELECT count(*)::int FROM "Encounter") AS encounters,
            (SELECT count(*)::int FROM "CashClosing") AS closings,
            (SELECT count(*)::int FROM "Patient" WHERE "userId" IS NOT NULL) AS portal_patients
        `);
        return result.rows[0];
      };

      runSeed();
      await verifyClosedDays();
      const first = await counts();
      assert.ok(first.appointments > 300, "faltan turnos históricos");
      assert.ok(first.payments > 50, "faltan cobros");
      assert.ok(first.encounters > 50, "faltan notas de atención");
      assert.ok(first.closings > 30, "faltan cajas cerradas");
      assert.equal(first.portal_patients, 2);
      const states = await db.query(`
        SELECT "status", count(*)::int AS count FROM "Appointment"
        WHERE "startsAt" < TIMESTAMP '2026-10-14 03:00:00'
        GROUP BY "status"
      `);
      for (const status of ["COMPLETED", "EXPIRED", "CANCELLED"]) {
        assert.ok(
          states.rows.some((row) => row.status === status && row.count > 20),
        );
      }
      const coverage = await db.query(`
        SELECT (max("startsAt")::date - min("startsAt")::date)::int AS days
        FROM "Appointment" WHERE "status" <> 'SCHEDULED'
      `);
      assert.ok(coverage.rows[0].days >= 85, "la historia no cubre tres meses");
      const invalidEncounters = await db.query(`
        SELECT count(*)::int AS count FROM "Encounter" e
        JOIN "Appointment" a ON a.id = e."appointmentId"
        WHERE a.status <> 'COMPLETED' OR a."professionalId" <> e."professionalId"
      `);
      assert.equal(invalidEncounters.rows[0].count, 0);
      const invalidClosings = await db.query(`
        SELECT count(*)::int AS count FROM "CashClosing" c
        WHERE c."paymentCount" <> (
          SELECT count(*) FROM "Payment" p
          WHERE p."cashClosingId" = c.id AND p.status = 'PAID'
        ) OR c."totalAmount" <> (
          SELECT coalesce(sum(p.amount), 0) FROM "Payment" p
          WHERE p."cashClosingId" = c.id AND p.status = 'PAID'
        ) OR c."expectedCashAmount" <> (
          SELECT coalesce(sum(p.amount), 0) FROM "Payment" p
          JOIN "PaymentMethod" m ON m.id = p."paymentMethodId"
          WHERE p."cashClosingId" = c.id AND p.status = 'PAID' AND m.name = 'Efectivo'
        )
      `);
      assert.equal(invalidClosings.rows[0].count, 0);
      const todayStates = await db.query(`
        SELECT "status", count(*)::int AS count FROM "Appointment"
        WHERE "startsAt" >= TIMESTAMP '2026-10-14 03:00:00'
          AND "startsAt" < TIMESTAMP '2026-10-15 03:00:00'
        GROUP BY "status" ORDER BY "status"
      `);
      if (withClosedDays) {
        assert.equal(todayStates.rows.length, 0);
      } else {
        assert.deepEqual(todayStates.rows.map((row) => row.status).sort(), [
          "CANCELLED",
          "COMPLETED",
          "EXPIRED",
          "SCHEDULED",
        ]);
      }
      console.log(
        `Estados de hoy: ${todayStates.rows.map((row) => `${row.status}=${row.count}`).join(", ")}`,
      );
      const missingCash = await db.query(`
        SELECT count(*)::int AS count FROM "Payment"
        WHERE "createdAt" < TIMESTAMP '2026-10-14 03:00:00'
          AND "cashClosingId" IS NULL
      `);
      assert.equal(missingCash.rows[0].count, 0);
      runSeed();
      await verifyClosedDays();
      assert.deepEqual(
        await counts(),
        first,
        "la segunda corrida duplicó datos",
      );
      console.log(
        withClosedDays
          ? "OK: cajas históricas y de hoy preservadas; idempotencia."
          : "OK: historia, cobros, atenciones, cajas, portal e idempotencia.",
      );
    } finally {
      await db.end();
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
}

main(false)
  .then(() => main(true))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
