import assert from "node:assert/strict";
import { test } from "node:test";
import type { Role } from "../src/generated/prisma/enums";
import { activeHref, navForRole } from "../src/lib/navigation";
import { canAccess } from "../src/lib/route-access";

const STAFF: Role[] = ["RECEPTIONIST", "PROFESSIONAL", "MANAGER"];

function labels(role: Role): string[] {
  return navForRole(role).flatMap((group) =>
    group.items.map((item) => item.label),
  );
}

test("todo link visible para un rol se puede abrir con ese rol", () => {
  for (const role of STAFF) {
    for (const group of navForRole(role)) {
      for (const item of group.items) {
        assert.ok(
          canAccess(item.href, role),
          `${role} ve "${item.label}" pero no puede abrir ${item.href}`,
        );
      }
    }
  }
});

test("cada rol ve exactamente sus links", () => {
  assert.deepEqual(labels("RECEPTIONIST"), [
    "Calendario",
    "Nuevo turno",
    "Agendas",
    "Pacientes",
    "Profesionales",
    "Servicios",
    "Feriados",
  ]);
  assert.deepEqual(labels("PROFESSIONAL"), [
    "Mi agenda",
    "Pacientes",
    "Mis horarios",
    "Servicios",
    "Feriados",
  ]);
  assert.deepEqual(labels("MANAGER"), [
    "Calendario",
    "Nuevo turno",
    "Agendas",
    "Pacientes",
    "Profesionales",
    "Servicios",
    "Feriados",
    "Usuarios",
  ]);
});

test("el paciente no ve ningún link", () => {
  assert.deepEqual(navForRole("PATIENT"), []);
});

test("ningún rol ve dos links con el mismo destino", () => {
  for (const role of STAFF) {
    const hrefs = navForRole(role).flatMap((group) =>
      group.items.map((item) => item.href),
    );
    assert.equal(new Set(hrefs).size, hrefs.length, role);
  }
});

test("activeHref marca el link de prefijo más largo", () => {
  const groups = navForRole("MANAGER");
  assert.equal(activeHref("/patients", groups), "/patients");
  assert.equal(activeHref("/patients/new", groups), "/patients");
  assert.equal(activeHref("/patients/12/edit", groups), "/patients");
  assert.equal(
    activeHref("/professionals/3/schedule", groups),
    "/professionals",
  );
  assert.equal(activeHref("/calendar", groups), "/calendar");
});

test("activeHref no confunde rutas que solo comparten el comienzo", () => {
  const groups = navForRole("MANAGER");
  assert.equal(activeHref("/usersettings", groups), undefined);
  assert.equal(activeHref("/appointments/5", groups), undefined);
});

test("canAccess replica los permisos de las páginas", () => {
  // Rutas donde el proxy anterior dejaba pasar a roles que la página rechaza.
  assert.equal(canAccess("/patients/new", "PROFESSIONAL"), false);
  assert.equal(canAccess("/patients/4/edit", "PROFESSIONAL"), false);
  assert.equal(canAccess("/professionals/4/edit", "RECEPTIONIST"), false);
  assert.equal(canAccess("/professionals", "PROFESSIONAL"), false);

  assert.equal(canAccess("/professionals/4", "PROFESSIONAL"), true);
  assert.equal(canAccess("/professionals/4/schedule", "PROFESSIONAL"), true);
  assert.equal(canAccess("/professionals/new", "MANAGER"), true);
  assert.equal(canAccess("/professionals/new", "RECEPTIONIST"), false);
  assert.equal(canAccess("/patients/4", "PROFESSIONAL"), true);
  assert.equal(canAccess("/agenda", "RECEPTIONIST"), true);
  assert.equal(canAccess("/my-schedule", "MANAGER"), false);
  assert.equal(canAccess("/users", "RECEPTIONIST"), false);
  assert.equal(canAccess("/calendar", "PROFESSIONAL"), false);
});
