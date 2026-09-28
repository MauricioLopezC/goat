import assert from "node:assert/strict";
import { test } from "node:test";
import { findEnvProblems, requireEnv } from "../src/lib/env";

const VALID = {
  DATABASE_URL: "postgresql://goat:goat@localhost:5432/goat?schema=public",
  SESSION_SECRET: "x".repeat(32),
};

test("un .env completo no tiene problemas", () => {
  assert.deepEqual(findEnvProblems(VALID), []);
});

test("avisa cada variable que falta", () => {
  const problems = findEnvProblems({});
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^DATABASE_URL: no está definida/);
  assert.match(problems[1], /^SESSION_SECRET: no está definida/);
});

test("si la variable está con otras mayúsculas, dice cuál es", () => {
  const problems = findEnvProblems({
    DATABASE_URL: VALID.DATABASE_URL,
    session_secret: VALID.SESSION_SECRET,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /aparece como "session_secret"/);
  assert.match(problems[0], /tiene que ser SESSION_SECRET/);
});

test("el secreto de sesión necesita al menos 32 caracteres", () => {
  const problems = findEnvProblems({ ...VALID, SESSION_SECRET: "corto" });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /tiene 5 caracteres y necesita al menos 32/);
});

test("DATABASE_URL tiene que ser una URL de PostgreSQL", () => {
  const problems = findEnvProblems({ ...VALID, DATABASE_URL: "goat" });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^DATABASE_URL: no es una URL de PostgreSQL/);
});

test("requireEnv devuelve el valor o lanza el mensaje descriptivo", () => {
  assert.equal(requireEnv("SESSION_SECRET", VALID), VALID.SESSION_SECRET);
  assert.throws(
    () => requireEnv("SESSION_SECRET", { session_secret: "x" }),
    /Revisá el archivo \.env[\s\S]*aparece como "session_secret"/,
  );
});
