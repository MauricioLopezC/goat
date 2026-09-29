// Verificación de HU-20 sobre PostgreSQL local migrado.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  createPaymentMethod,
  updatePaymentMethod,
  listPaymentMethods,
  listActivePaymentMethods,
} from "../src/lib/dal/payment-methods";
import { DomainError } from "../src/lib/actions";
import { Role } from "../src/generated/prisma/enums";
import type { Actor } from "../src/lib/dal/auth";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Esta verificación solo usa PostgreSQL local.",
  );
  assert.notEqual(process.env.NODE_ENV, "production");

  const tag = `HU20-${randomUUID()}`;
  const users: number[] = [];
  const paymentMethods: number[] = [];
  let passed = 0;

  async function verify(label: string, run: () => Promise<void>) {
    await run();
    passed++;
    console.log(`OK ${label}`);
  }

  async function rejects(run: () => Promise<unknown>, code: string) {
    await assert.rejects(
      run,
      (error: unknown) => error instanceof DomainError && error.code === code,
    );
  }

  try {
    // 1. Usuarios de prueba: Manager, Receptionist, Professional
    const managerUser = await prisma.user.create({
      data: {
        email: `${tag}-mgr@example.invalid`,
        passwordHash: "hash",
        firstName: "Gerente",
        lastName: tag,
        role: Role.MANAGER,
      },
    });
    users.push(managerUser.id);
    const managerActor: Actor = managerUser;

    const receptionistUser = await prisma.user.create({
      data: {
        email: `${tag}-rec@example.invalid`,
        passwordHash: "hash",
        firstName: "Recepcionista",
        lastName: tag,
        role: Role.RECEPTIONIST,
      },
    });
    users.push(receptionistUser.id);
    const receptionistActor: Actor = receptionistUser;

    const professionalUser = await prisma.user.create({
      data: {
        email: `${tag}-pro@example.invalid`,
        passwordHash: "hash",
        firstName: "Profesional",
        lastName: tag,
        role: Role.PROFESSIONAL,
      },
    });
    users.push(professionalUser.id);
    const professionalActor: Actor = professionalUser;

    // 2. Permisos: Professional no puede listar ni crear ni modificar
    await verify(
      "permisos: profesional sin acceso a medios de pago",
      async () => {
        await rejects(() => listPaymentMethods(professionalActor), "FORBIDDEN");
        await rejects(
          () => listActivePaymentMethods(professionalActor),
          "FORBIDDEN",
        );
        await rejects(
          () => createPaymentMethod({ name: `Pro-${tag}` }, professionalActor),
          "FORBIDDEN",
        );
        await rejects(
          () =>
            updatePaymentMethod(
              { id: 1, name: "Test", active: true },
              professionalActor,
            ),
          "FORBIDDEN",
        );
      },
    );

    // 3. Permisos: Receptionist solo puede consultar
    await verify("permisos: recepcionista solo lectura", async () => {
      const all = await listPaymentMethods(receptionistActor);
      assert.ok(Array.isArray(all));
      const active = await listActivePaymentMethods(receptionistActor);
      assert.ok(Array.isArray(active));

      await rejects(
        () => createPaymentMethod({ name: `Rec-${tag}` }, receptionistActor),
        "FORBIDDEN",
      );
      await rejects(
        () =>
          updatePaymentMethod(
            { id: 1, name: "Test", active: true },
            receptionistActor,
          ),
        "FORBIDDEN",
      );
    });

    // 4. Creación y trimming defensivo
    let pm1Id = 0;
    await verify("creación con trimming defensivo", async () => {
      const created = await createPaymentMethod(
        { name: `  Billetera Virtual ${tag}  ` },
        managerActor,
      );
      pm1Id = created.id;
      paymentMethods.push(created.id);

      assert.equal(created.name, `Billetera Virtual ${tag}`);
      assert.equal(created.active, true);

      const fromDb = await prisma.paymentMethod.findUnique({
        where: { id: created.id },
      });
      assert.equal(fromDb?.name, `Billetera Virtual ${tag}`);
      assert.equal(fromDb?.active, true);
    });

    // 5. Unicidad insensible a mayúsculas y tildes
    await verify(
      "unicidad de nombre insensible a mayúsculas y acentos",
      async () => {
        await rejects(
          () =>
            createPaymentMethod(
              { name: `Billetera Virtual ${tag}` },
              managerActor,
            ),
          "DUPLICATE",
        );

        await rejects(
          () =>
            createPaymentMethod(
              { name: `billetera virtual ${tag}` },
              managerActor,
            ),
          "DUPLICATE",
        );

        const createdAccented = await createPaymentMethod(
          { name: `Cupón ${tag}` },
          managerActor,
        );
        paymentMethods.push(createdAccented.id);

        await rejects(
          () => createPaymentMethod({ name: `cupon ${tag}` }, managerActor),
          "DUPLICATE",
        );
      },
    );

    // 6. Modificación y reactivación con trimming
    await verify("modificación de nombre y estado con trimming", async () => {
      const updated = await updatePaymentMethod(
        {
          id: pm1Id,
          name: `  Billetera Digital ${tag}  `,
          active: false,
        },
        managerActor,
      );
      assert.equal(updated.name, `Billetera Digital ${tag}`);
      assert.equal(updated.active, false);

      const reactivated = await updatePaymentMethod(
        {
          id: pm1Id,
          name: `Billetera Digital ${tag}`,
          active: true,
        },
        managerActor,
      );
      assert.equal(reactivated.active, true);
    });

    // 7. Regla LAST_ACTIVE_PAYMENT_METHOD
    await verify(
      "regla LAST_ACTIVE_PAYMENT_METHOD: impide desactivar el último medio activo",
      async () => {
        const originalMethods = await prisma.paymentMethod.findMany();

        try {
          // Desactivar temporalmente todos los medios excepto pm1Id
          await prisma.paymentMethod.updateMany({
            where: { id: { not: pm1Id } },
            data: { active: false },
          });

          const activeCount = await prisma.paymentMethod.count({
            where: { active: true },
          });
          assert.equal(activeCount, 1);

          // Desactivar el único activo debe fallar con LAST_ACTIVE_PAYMENT_METHOD
          await rejects(
            () =>
              updatePaymentMethod(
                { id: pm1Id, name: `Billetera Digital ${tag}`, active: false },
                managerActor,
              ),
            "LAST_ACTIVE_PAYMENT_METHOD",
          );

          // Si reactivamos otro medio, ahora desactivar pm1Id sí se permite
          const otherMethod = originalMethods.find((m) => m.id !== pm1Id);
          if (otherMethod) {
            await updatePaymentMethod(
              { id: otherMethod.id, name: otherMethod.name, active: true },
              managerActor,
            );

            const deactivated = await updatePaymentMethod(
              { id: pm1Id, name: `Billetera Digital ${tag}`, active: false },
              managerActor,
            );
            assert.equal(deactivated.active, false);
          }
        } finally {
          // Restaurar estado original de los medios preexistentes
          for (const m of originalMethods) {
            if (!paymentMethods.includes(m.id)) {
              await prisma.paymentMethod.update({
                where: { id: m.id },
                data: { name: m.name, active: m.active },
              });
            }
          }
        }
      },
    );

    // 8. listPaymentMethods vs listActivePaymentMethods
    await verify("listActivePaymentMethods solo devuelve activos", async () => {
      const activeList = await listActivePaymentMethods(managerActor);
      for (const m of activeList) {
        const fromDb = await prisma.paymentMethod.findUnique({
          where: { id: m.id },
        });
        assert.equal(fromDb?.active, true);
      }
    });

    console.log(
      `${passed} grupos de verificaciones HU-20 PostgreSQL correctos.`,
    );
  } finally {
    if (paymentMethods.length) {
      await prisma.paymentMethod.deleteMany({
        where: { id: { in: paymentMethods } },
      });
    }
    if (users.length) {
      await prisma.user.deleteMany({
        where: { id: { in: users } },
      });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Falló la verificación de medios de pago:", err);
  process.exit(1);
});
