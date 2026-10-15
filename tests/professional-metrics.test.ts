import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateAgeAt,
  calculateProfessionalMetrics,
  classifyAgeRange,
  type PatientMetricData,
  type ProfessionalAppointmentMetric,
} from "../src/lib/professional-metrics";

test("calculateAgeAt calcula correctamente la edad a la fecha del turno", () => {
  // Nació el 15/09/2000
  const birth = "2000-09-15T00:00:00.000Z";

  // El 14/09/2018 tenía 17 años (menor de 18)
  assert.equal(calculateAgeAt(birth, "2018-09-14T10:00:00.000Z"), 17);
  // El 15/09/2018 cumplió 18 años
  assert.equal(calculateAgeAt(birth, "2018-09-15T10:00:00.000Z"), 18);
  // El 16/09/2018 tenía 18 años
  assert.equal(calculateAgeAt(birth, "2018-09-16T10:00:00.000Z"), 18);

  // Rangos de corte exactos
  assert.equal(classifyAgeRange(17), "UNDER_18");
  assert.equal(classifyAgeRange(18), "FROM_18_TO_39");
  assert.equal(classifyAgeRange(39), "FROM_18_TO_39");
  assert.equal(classifyAgeRange(40), "FROM_40_TO_64");
  assert.equal(classifyAgeRange(64), "FROM_40_TO_64");
  assert.equal(classifyAgeRange(65), "FROM_65_AND_OVER");
  assert.equal(classifyAgeRange(80), "FROM_65_AND_OVER");
});

test("período sin turnos devuelve tasas en null y colecciones en cero", () => {
  const period = { from: "2026-09", to: "2026-09" };
  const metrics = calculateProfessionalMetrics(period, [], [], new Set());

  assert.equal(metrics.totalAppointments, 0);
  assert.equal(metrics.completedAppointments, 0);
  assert.equal(metrics.completedRate, null);
  assert.equal(metrics.expiredAppointments, 0);
  assert.equal(metrics.expiredRate, null);
  assert.equal(metrics.cancelledAppointments, 0);
  assert.equal(metrics.cancelledRate, null);

  assert.deepEqual(metrics.services, []);
  assert.equal(metrics.distinctPatientsCount, 0);
  assert.equal(metrics.newPatientsCount, 0);
  assert.equal(metrics.newPatientsRate, null);

  assert.ok(
    metrics.genderDistribution.every(
      (g) => g.count === 0 && g.percentage === null,
    ),
  );
  assert.ok(
    metrics.ageDistribution.every(
      (a) => a.count === 0 && a.percentage === null,
    ),
  );
});

test("calcula tasas de turnos, servicios agrupados y pacientes nuevos vs recurrentes", () => {
  const period = { from: "2026-09", to: "2026-09" };

  const appointments: ProfessionalAppointmentMetric[] = [
    // Paciente 1 (recurrente porque está en priorPatientIds): 2 turnos completados de Kine
    {
      id: 1,
      patientId: 1,
      serviceId: 10,
      serviceName: "Kinesiología",
      startsAt: new Date("2026-09-02T10:00:00.000Z"),
      status: "COMPLETED",
    },
    {
      id: 2,
      patientId: 1,
      serviceId: 10,
      serviceName: "Kinesiología",
      startsAt: new Date("2026-09-09T10:00:00.000Z"),
      status: "COMPLETED",
    },
    // Paciente 2 (nuevo): 1 turno completado de Traumatología
    {
      id: 3,
      patientId: 2,
      serviceId: 20,
      serviceName: "Traumatología",
      startsAt: new Date("2026-09-05T11:00:00.000Z"),
      status: "COMPLETED",
    },
    // Paciente 3 (nuevo): 1 turno completado de Kinesiología
    {
      id: 4,
      patientId: 3,
      serviceId: 10,
      serviceName: "Kinesiología",
      startsAt: new Date("2026-09-07T12:00:00.000Z"),
      status: "COMPLETED",
    },
    // 1 Vencido
    {
      id: 5,
      patientId: 4,
      serviceId: 20,
      serviceName: "Traumatología",
      startsAt: new Date("2026-09-10T15:00:00.000Z"),
      status: "EXPIRED",
    },
    // 1 Cancelado
    {
      id: 6,
      patientId: 5,
      serviceId: 10,
      serviceName: "Kinesiología",
      startsAt: new Date("2026-09-12T16:00:00.000Z"),
      status: "CANCELLED",
    },
  ];

  // Pacientes atendidos: 1, 2 y 3.
  // Paciente 1: Femenino, 70 años al turno (nac. 1956)
  // Paciente 2: Masculino, 30 años al turno (nac. 1996)
  // Paciente 3: Otro, 15 años al turno (nac. 2011)
  const patients: PatientMetricData[] = [
    {
      id: 1,
      gender: "FEMALE",
      birthDate: new Date("1956-05-10T00:00:00.000Z"),
    },
    { id: 2, gender: "MALE", birthDate: new Date("1996-03-20T00:00:00.000Z") },
    { id: 3, gender: "OTHER", birthDate: new Date("2011-08-15T00:00:00.000Z") },
  ];

  // Paciente 1 ya se atendió antes; 2 y 3 son nuevos
  const priorPatientIds = new Set([1]);

  const metrics = calculateProfessionalMetrics(
    period,
    appointments,
    patients,
    priorPatientIds,
  );

  // Turnos totales: 6 turnos
  assert.equal(metrics.totalAppointments, 6);
  assert.equal(metrics.completedAppointments, 4);
  assert.equal(metrics.completedRate, 4 / 6);
  assert.equal(metrics.expiredAppointments, 1);
  assert.equal(metrics.expiredRate, 1 / 6);
  assert.equal(metrics.cancelledAppointments, 1);
  assert.equal(metrics.cancelledRate, 1 / 6);

  // Servicios: Kinesiología (4 turnos) y Traumatología (2 turnos)
  assert.equal(metrics.services.length, 2);
  assert.equal(metrics.services[0].serviceName, "Kinesiología");
  assert.equal(metrics.services[0].count, 4);
  assert.equal(metrics.services[0].percentage, 4 / 6);
  assert.equal(metrics.services[1].serviceName, "Traumatología");
  assert.equal(metrics.services[1].count, 2);
  assert.equal(metrics.services[1].percentage, 2 / 6);

  // Pacientes: 3 distintos atendidos, 2 nuevos
  assert.equal(metrics.distinctPatientsCount, 3);
  assert.equal(metrics.newPatientsCount, 2);
  assert.equal(metrics.newPatientsRate, 2 / 3);

  // Sexo: 1 FEMALE (1/3), 1 MALE (1/3), 1 OTHER (1/3)
  const fem = metrics.genderDistribution.find((g) => g.gender === "FEMALE");
  const masc = metrics.genderDistribution.find((g) => g.gender === "MALE");
  const oth = metrics.genderDistribution.find((g) => g.gender === "OTHER");
  assert.equal(fem?.count, 1);
  assert.equal(fem?.percentage, 1 / 3);
  assert.equal(masc?.count, 1);
  assert.equal(masc?.percentage, 1 / 3);
  assert.equal(oth?.count, 1);
  assert.equal(oth?.percentage, 1 / 3);

  // Edades:
  // - Paciente 3 (15 años) -> UNDER_18
  // - Paciente 2 (30 años) -> FROM_18_TO_39
  // - Paciente 1 (70 años) -> FROM_65_AND_OVER
  const under18 = metrics.ageDistribution.find((a) => a.range === "UNDER_18");
  const from18to39 = metrics.ageDistribution.find(
    (a) => a.range === "FROM_18_TO_39",
  );
  const from40to64 = metrics.ageDistribution.find(
    (a) => a.range === "FROM_40_TO_64",
  );
  const from65plus = metrics.ageDistribution.find(
    (a) => a.range === "FROM_65_AND_OVER",
  );

  assert.equal(under18?.count, 1);
  assert.equal(under18?.percentage, 1 / 3);
  assert.equal(from18to39?.count, 1);
  assert.equal(from18to39?.percentage, 1 / 3);
  assert.equal(from40to64?.count, 0);
  assert.equal(from40to64?.percentage, 0);
  assert.equal(from65plus?.count, 1);
  assert.equal(from65plus?.percentage, 1 / 3);
});
