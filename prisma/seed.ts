import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🌱 Sembrando datos iniciales...");

  // 1. Usuario Gerente (para que auth y createdBy funcionen)
  const manager = await prisma.user.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      username: "gerente",
      lastName: "García",
      firstName: "Martín",
      role: "MANAGER",
      passwordHash: "hash_dev_temporal",
      active: true,
    },
  });
  console.log(
    `✓ Usuario gerente listo: ${manager.firstName} ${manager.lastName} (ID: ${manager.id})`,
  );

  // 2. Títulos profesionales
  const titles = [
    { name: "Médico Traumatólogo" },
    { name: "Licenciado en Kinesiología y Fisiatría" },
    { name: "Médico Cirujano Ortopédico" },
  ];

  for (const t of titles) {
    await prisma.professionalTitle.upsert({
      where: { name: t.name },
      update: {},
      create: { name: t.name, active: true },
    });
  }
  console.log("✓ Títulos profesionales creados");

  // 3. Catálogo inicial de servicios (prestaciones)
  const services = [
    { name: "Consulta traumatológica general", durationMinutes: 30 },
    { name: "Control post-quirúrgico", durationMinutes: 30 },
    { name: "Sesión de kinesiología motora", durationMinutes: 30 },
    { name: "Rehabilitación deportiva", durationMinutes: 30 },
    { name: "Curación y retiro de puntos", durationMinutes: 30 },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { name: s.name },
      update: {},
      create: {
        name: s.name,
        durationMinutes: s.durationMinutes,
        active: true,
      },
    });
  }
  console.log("✓ Catálogo de servicios creado");

  console.log("🚀 Datos semilla cargados con éxito.");
}

main().catch((e) => {
  console.error("Error al sembrar datos:", e);
  process.exit(1);
});
