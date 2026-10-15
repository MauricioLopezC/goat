import assert from "node:assert/strict";
import { getProfessionalIndicators } from "../src/lib/dal/indicators";
import type { Actor } from "../src/lib/dal/auth";
import { currentPeriod, shiftMonthKey } from "../src/lib/indicators";
import { prisma } from "../src/lib/prisma";
import { Role } from "../src/generated/prisma/enums";
import { DomainError } from "../src/lib/actions";

async function main() {
  const to = currentPeriod().to;
  const from = shiftMonthKey(to, -2);

  // 1. Verificar restricciones de roles
  const nonProActor: Actor = {
    id: 999999,
    firstName: "Test",
    lastName: "Recepción",
    email: "test-recep@goat.local",
    role: Role.RECEPTIONIST,
  };
  await assert.rejects(
    getProfessionalIndicators({ from, to }, nonProActor),
    (err: unknown) => err instanceof DomainError && err.code === "FORBIDDEN",
  );

  const managerActor: Actor = {
    id: 999999,
    firstName: "Test",
    lastName: "Gerente",
    email: "test-mgr@goat.local",
    role: Role.MANAGER,
  };
  await assert.rejects(
    getProfessionalIndicators({ from, to }, managerActor),
    (err: unknown) => err instanceof DomainError && err.code === "FORBIDDEN",
  );

  // 2. Profesional sin perfil en tabla Professional
  const ghostProActor: Actor = {
    id: 999999,
    firstName: "Test",
    lastName: "Fantasma",
    email: "test-ghost@goat.local",
    role: Role.PROFESSIONAL,
  };
  await assert.rejects(
    getProfessionalIndicators({ from, to }, ghostProActor),
    (err: unknown) => err instanceof DomainError && err.code === "NOT_FOUND",
  );

  // 3. Buscar profesional real de la base
  const realPro = await prisma.professional.findFirst({
    where: { user: { role: Role.PROFESSIONAL } },
    include: { user: true },
  });
  assert.ok(
    realPro,
    "Debe existir al menos un profesional con usuario en la base de datos.",
  );

  const proActor: Actor = {
    id: realPro.userId as number,
    firstName: realPro.firstName,
    lastName: realPro.lastName,
    email: realPro.user?.email ?? "pro@goat.local",
    role: Role.PROFESSIONAL,
  };

  // 4. Período inválido
  await assert.rejects(
    getProfessionalIndicators({ from: "2026-01", to: "2026-05" }, proActor),
    (err: unknown) => err instanceof DomainError && err.code === "VALIDATION",
  );
  await assert.rejects(
    getProfessionalIndicators({ from: "2026-09", to: "2026-05" }, proActor),
    (err: unknown) => err instanceof DomainError && err.code === "VALIDATION",
  );

  // 5. Consulta válida de indicadores
  const result = await getProfessionalIndicators({ from, to }, proActor);
  assert.equal(result.professional.id, realPro.id);
  assert.equal(result.period.from, from);
  assert.equal(result.period.to, to);

  const { metrics } = result;

  // Verificaciones de consistencia matemática
  const sumStatuses =
    metrics.completedAppointments +
    metrics.expiredAppointments +
    metrics.cancelledAppointments;
  assert.ok(
    sumStatuses <= metrics.totalAppointments,
    "La suma de estados cerrados no puede exceder el total.",
  );

  if (metrics.totalAppointments > 0) {
    assert.equal(
      metrics.completedRate,
      metrics.completedAppointments / metrics.totalAppointments,
    );
    assert.equal(
      metrics.expiredRate,
      metrics.expiredAppointments / metrics.totalAppointments,
    );
    assert.equal(
      metrics.cancelledRate,
      metrics.cancelledAppointments / metrics.totalAppointments,
    );
    assert.equal(
      metrics.services.reduce((sum, s) => sum + s.count, 0),
      metrics.totalAppointments,
    );
  } else {
    assert.equal(metrics.completedRate, null);
    assert.equal(metrics.expiredRate, null);
    assert.equal(metrics.cancelledRate, null);
    assert.equal(metrics.services.length, 0);
  }

  // Pacientes atendidos y nuevos
  assert.ok(metrics.newPatientsCount <= metrics.distinctPatientsCount);
  if (metrics.distinctPatientsCount > 0) {
    assert.equal(
      metrics.newPatientsRate,
      metrics.newPatientsCount / metrics.distinctPatientsCount,
    );
    assert.equal(
      metrics.genderDistribution.reduce((sum, g) => sum + g.count, 0),
      metrics.distinctPatientsCount,
    );
    assert.equal(
      metrics.ageDistribution.reduce((sum, a) => sum + a.count, 0),
      metrics.distinctPatientsCount,
    );
  } else {
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
  }

  console.log(
    `HU-30: Verificación exitosa para ${realPro.lastName}, ${realPro.firstName} (ID ${realPro.id}) con ${metrics.totalAppointments} turnos y ${metrics.distinctPatientsCount} pacientes atendidos en el período ${from} a ${to}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
