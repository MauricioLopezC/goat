import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterServices,
  groupServicesBySpecialty,
  normalizeSearchText,
  NO_SPECIALTY_GROUP,
  type ServiceOption,
} from "../src/lib/services";
import { SERVICES, PROFESSIONALS, AVAILABILITY } from "../prisma/seed-data";

test("normalizeSearchText remueve acentos y pasa a minúsculas", () => {
  assert.equal(normalizeSearchText("Traumatología"), "traumatologia");
  assert.equal(normalizeSearchText("KINESIOLOGÍA"), "kinesiologia");
  assert.equal(
    normalizeSearchText("  Cirugía Post-Quirúrgica  "),
    "cirugia post-quirurgica",
  );
  assert.equal(normalizeSearchText("Áéíóú"), "aeiou");
});

test("filterServices filtra insensibilizando mayúsculas, minúsculas y tildes", () => {
  const sample: ServiceOption[] = [
    {
      id: 1,
      name: "Consulta de Rodilla",
      durationMinutes: 30,
      specialty: { id: 10, name: "Rodilla" },
    },
    {
      id: 2,
      name: "Evaluación kinesiológica inicial",
      durationMinutes: 60,
      specialty: { id: 20, name: "Kinesiología y rehabilitación" },
    },
    {
      id: 3,
      name: "Consulta de Columna",
      durationMinutes: 30,
      specialty: { id: 30, name: "Columna" },
    },
    {
      id: 4,
      name: "Control post-quirúrgico",
      durationMinutes: 30,
      specialty: null,
    },
  ];

  // Búsqueda sin acentos que coincide con nombre con acento
  const res1 = filterServices(sample, "kinesiologica");
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, 2);

  // Búsqueda en mayúsculas
  const res2 = filterServices(sample, "RODILLA");
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, 1);

  // Búsqueda por especialidad
  const res3 = filterServices(sample, "rehabilitacion");
  assert.equal(res3.length, 1);
  assert.equal(res3[0].id, 2);

  // Búsqueda por parte de nombre sin especialidad
  const res4 = filterServices(sample, "quirurgico");
  assert.equal(res4.length, 1);
  assert.equal(res4[0].id, 4);

  // Búsqueda vacía devuelve todos
  assert.equal(filterServices(sample, "").length, 4);
  assert.equal(filterServices(sample, "   ").length, 4);

  // Búsqueda sin coincidencias devuelve array vacío
  assert.equal(filterServices(sample, "inexistente123").length, 0);
});

test("groupServicesBySpecialty agrupa por especialidad y ordena alfabéticamente según es-AR", () => {
  const sample: ServiceOption[] = [
    {
      id: 1,
      name: "Consulta de Rodilla",
      durationMinutes: 30,
      specialty: { id: 10, name: "Rodilla" },
    },
    {
      id: 2,
      name: "Artrocentesis",
      durationMinutes: 30,
      specialty: { id: 10, name: "Rodilla" },
    },
    {
      id: 3,
      name: "Consulta traumatológica general",
      durationMinutes: 30,
      specialty: null,
    },
    {
      id: 4,
      name: "Consulta de Columna",
      durationMinutes: 30,
      specialty: { id: 30, name: "Columna" },
    },
    {
      id: 5,
      name: "Bloqueo radicular",
      durationMinutes: 30,
      specialty: { id: 30, name: "Columna" },
    },
  ];

  const groups = groupServicesBySpecialty(sample);

  // Debe haber 3 grupos: "Columna", "Rodilla", "Sin especialidad"
  assert.equal(groups.length, 3);

  const groupColumna = groups.find((g) => g.specialtyName === "Columna");
  assert.ok(groupColumna);
  // Servicios dentro del grupo ordenados alfabéticamente: Bloqueo radicular antes de Consulta de Columna
  assert.equal(groupColumna.services[0].name, "Bloqueo radicular");
  assert.equal(groupColumna.services[1].name, "Consulta de Columna");

  const groupRodilla = groups.find((g) => g.specialtyName === "Rodilla");
  assert.ok(groupRodilla);
  assert.equal(groupRodilla.services[0].name, "Artrocentesis");
  assert.equal(groupRodilla.services[1].name, "Consulta de Rodilla");

  const groupSinEsp = groups.find(
    (g) => g.specialtyName === NO_SPECIALTY_GROUP,
  );
  assert.ok(groupSinEsp);
  assert.equal(groupSinEsp.services.length, 1);
  assert.equal(groupSinEsp.services[0].name, "Consulta traumatológica general");
});

test("Invariantes del seed de servicios: exactamente 40 servicios (39 activos, 1 inactivo)", () => {
  assert.equal(
    SERVICES.length,
    40,
    "El seed debe tener exactamente 40 servicios en total",
  );

  const activeServices = SERVICES.filter((s) => s.active);
  const inactiveServices = SERVICES.filter((s) => !s.active);

  assert.equal(
    activeServices.length,
    39,
    "Debe haber exactamente 39 servicios activos",
  );
  assert.equal(
    inactiveServices.length,
    1,
    "Debe haber exactamente 1 servicio inactivo",
  );
  assert.equal(
    inactiveServices[0].name,
    "Magnetoterapia",
    "El servicio inactivo debe ser Magnetoterapia",
  );

  // Verificar que cada servicio activo está asociado a al menos un profesional activo que tiene franjas horarias
  const activeProfessionalsWithWindows = PROFESSIONALS.filter((p) => {
    const isDeactivated = !!p.deactivation;
    const hasWindows = !!AVAILABILITY[p.licenseNumber]?.length;
    return !isDeactivated && hasWindows;
  });

  for (const service of activeServices) {
    const offeringPros = activeProfessionalsWithWindows.filter((p) =>
      p.services.includes(service.name),
    );
    assert.ok(
      offeringPros.length >= 1,
      `El servicio activo "${service.name}" debe ser ofrecido por al menos un profesional activo con agenda`,
    );
  }
});
