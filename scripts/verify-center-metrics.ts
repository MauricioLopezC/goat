import assert from "node:assert/strict";
import { getCenterIndicators } from "../src/lib/dal/indicators";
import type { Actor } from "../src/lib/dal/auth";
import { currentPeriod, shiftMonthKey } from "../src/lib/indicators";
import { prisma } from "../src/lib/prisma";

const manager: Actor = {
  id: 0,
  firstName: "Verificación",
  lastName: "Local",
  email: "verification@goat.local",
  role: "MANAGER",
};

async function main() {
  const to = currentPeriod().to;
  const from = shiftMonthKey(to, -2);
  const data = await getCenterIndicators({ from, to }, manager);
  const { details } = data;
  assert.equal(details.cancelled, data.center.cancelled);
  assert.equal(
    details.cancellationRate,
    details.appointmentCount > 0
      ? details.cancelled / details.appointmentCount
      : null,
  );
  assert.equal(
    details.income.totalCents,
    details.income.months.reduce((sum, month) => sum + month.cents, 0),
  );
  assert.equal(
    details.income.totalCents,
    details.income.methods.reduce((sum, method) => sum + method.cents, 0),
  );
  const firstProfessional = data.professionals[0];
  if (firstProfessional) {
    const filtered = await getCenterIndicators(
      { from, to, professionalId: firstProfessional.id },
      manager,
    );
    assert.equal(filtered.professionals.length, 1);
    assert.equal(filtered.details.professionals.length <= 1, true);
    assert.equal(filtered.details.cancelled, firstProfessional.cancelled);
  }
  await assert.rejects(
    getCenterIndicators({ from, to }, { ...manager, role: "RECEPTIONIST" }),
    { code: "FORBIDDEN" },
  );
  console.log(
    `HU-29: ${details.appointmentCount} turnos, ${details.income.totalCents} centavos en cobros vigentes; totales, filtro y rol correctos.`,
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
