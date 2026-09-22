// Igual que `prisma.config.ts`: al correr con tsx nadie carga el .env.
import "dotenv/config";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";

// Datos mínimos para poder entrar al sistema (HU-01) y probar profesionales (HU-02).
//
// Existe por un problema de arranque: solo un `MANAGER` crea usuarios, y una
// base recién migrada no tiene ninguno. El seed crea ese primer gerente.
//
// Los otros dos usuarios son comodidad de desarrollo, para probar que cada rol
// aterriza en su pantalla mientras `createUser` no tenga interfaz. En un centro
// real los daría de alta el gerente.
//
// Es idempotente: se puede correr las veces que haga falta.

// Mismos parámetros que `src/lib/password.ts`, que no se puede importar acá
// porque es `server-only`. Quedan escritos dentro del hash, así que aunque se
// desincronizaran, `verify` los lee del hash y las contraseñas siguen andando.
const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

const USERS = [
  {
    email: "gerente@goat.local",
    firstName: "Laura",
    lastName: "Gómez",
    role: Role.MANAGER,
  },
  {
    email: "mesa@goat.local",
    firstName: "Marcos",
    lastName: "Díaz",
    role: Role.RECEPTIONIST,
  },
  {
    email: "profesional@goat.local",
    firstName: "Julia",
    lastName: "Ferrari",
    role: Role.PROFESSIONAL,
  },
];

const TITLES = [
  { name: "Médico Traumatólogo" },
  { name: "Licenciado en Kinesiología y Fisiatría" },
  { name: "Médico Cirujano Ortopédico" },
];

const SERVICES = [
  { name: "Consulta traumatológica general", durationMinutes: 30 },
  { name: "Control post-quirúrgico", durationMinutes: 30 },
  { name: "Sesión de kinesiología motora", durationMinutes: 30 },
  { name: "Rehabilitación deportiva", durationMinutes: 30 },
  { name: "Curación y retiro de puntos", durationMinutes: 30 },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "El seed crea usuarios con una contraseña conocida: no se corre en producción.",
    );
  }

  const password = process.env.SEED_PASSWORD ?? "goat1234";
  if (password.length < 8) {
    throw new Error("SEED_PASSWORD debe tener al menos 8 caracteres.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    console.log("🌱 Sembrando datos...");

    // 1. Usuarios del sistema
    const passwordHash = await hash(password, ARGON2);

    for (const user of USERS) {
      // `update` deja la contraseña en un valor conocido si alguien la cambió
      // probando, que es justamente para lo que sirve este seed.
      await prisma.user.upsert({
        where: { email: user.email },
        create: { ...user, passwordHash, active: true },
        update: { ...user, passwordHash, active: true },
      });
      console.log(`  ${user.role.padEnd(12)}  ${user.email}`);
    }

    // 2. Títulos profesionales
    for (const t of TITLES) {
      await prisma.professionalTitle.upsert({
        where: { name: t.name },
        update: {},
        create: { name: t.name, active: true },
      });
    }
    console.log("✓ Títulos profesionales listos");

    // 3. Catálogo de servicios
    for (const s of SERVICES) {
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
    console.log("✓ Catálogo de servicios listo");

    console.log(`\nContraseña de los tres usuarios: ${password}`);
    console.log("Cambiala con SEED_PASSWORD si te molesta.");
  } finally {
    await prisma.$disconnect();
  }
}

// Sin top-level await: el paquete no es ESM y `tsx` compila a CommonJS.
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
