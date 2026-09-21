// Igual que `prisma.config.ts`: al correr con tsx nadie carga el .env.
import "dotenv/config";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";

// Datos mínimos para poder entrar al sistema (HU-01).
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

    console.log(`\nContraseña de los tres: ${password}`);
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
