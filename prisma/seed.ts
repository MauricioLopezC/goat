// Igual que `prisma.config.ts`: al correr con tsx nadie carga el .env.
import "dotenv/config";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPatientSchema } from "../src/lib/validation/patients";
import { createProfessionalSchema } from "../src/lib/validation/professional";
import { createServiceSchema } from "../src/lib/validation/service";
import {
  HEALTH_INSURERS,
  MANAGER_EMAIL,
  PATIENTS,
  PROFESSIONALS,
  SEED_USERS,
  SERVICES,
  SPECIALTIES,
  TITLES,
} from "./seed-data";

// Datos de prueba para lo que ya está implementado: usuarios (HU-01),
// profesionales (HU-02), catálogo de servicios (HU-06) y pacientes (HU-07).
// Los datos están en `seed-data.ts`.
//
// Existe, además, por un problema de arranque: solo un `MANAGER` crea
// usuarios, y una base recién migrada no tiene ninguno.
//
// Es idempotente: cada registro se hace `upsert` por su clave natural, y al
// volver a correrlo los registros del seed vuelven a sus valores sembrados. Lo
// que se cargó desde la UI no se toca.
//
// Franjas, feriados y turnos no se siembran hasta que existan HU-05 y HU-09.

// Mismos parámetros que `src/lib/password.ts`, que no se puede importar acá
// porque es `server-only`. Quedan escritos dentro del hash, así que aunque se
// desincronizaran, `verify` los lee del hash y las contraseñas siguen andando.
const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

type Ids = Map<string, number>;

function idOf(ids: Ids, key: string, kind: string): number {
  const id = ids.get(key);
  if (id === undefined) {
    throw new Error(`seed-data.ts: ${kind} "${key}" no existe en el seed.`);
  }
  return id;
}

async function seedUsers(prisma: PrismaClient, password: string) {
  const passwordHash = await hash(password, ARGON2);
  const ids: Ids = new Map();

  for (const user of SEED_USERS) {
    // `update` deja la contraseña en un valor conocido si alguien la cambió
    // probando, que es justamente para lo que sirve este seed.
    const { id } = await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, passwordHash },
      update: { ...user, passwordHash },
      select: { id: true },
    });
    ids.set(user.email, id);
    const note = user.active ? "" : "  (inactivo)";
    console.log(`  ${user.role.padEnd(12)}  ${user.email}${note}`);
  }

  return ids;
}

async function seedCatalog(prisma: PrismaClient) {
  const titleIds: Ids = new Map();
  for (const t of TITLES) {
    const { id } = await prisma.professionalTitle.upsert({
      where: { name: t.name },
      create: t,
      update: t,
      select: { id: true },
    });
    titleIds.set(t.name, id);
  }

  const specialtyIds: Ids = new Map();
  for (const s of SPECIALTIES) {
    const { id } = await prisma.specialty.upsert({
      where: { name: s.name },
      create: s,
      update: s,
      select: { id: true },
    });
    specialtyIds.set(s.name, id);
  }

  const serviceIds: Ids = new Map();
  for (const { specialty, active, ...fields } of SERVICES) {
    const specialtyId = specialty
      ? idOf(specialtyIds, specialty, "Especialidad")
      : null;
    const input = createServiceSchema.parse({ ...fields, specialtyId });
    const data = { ...input, active };

    const { id } = await prisma.service.upsert({
      where: { name: input.name },
      create: data,
      update: data,
      select: { id: true },
    });
    serviceIds.set(input.name, id);
  }

  return { titleIds, serviceIds };
}

async function seedProfessionals(
  prisma: PrismaClient,
  userIds: Ids,
  titleIds: Ids,
  serviceIds: Ids,
) {
  const managerId = idOf(userIds, MANAGER_EMAIL, "Usuario");

  for (const p of PROFESSIONALS) {
    const input = createProfessionalSchema.parse({
      ...p,
      titleIds: p.titles.map((t) => idOf(titleIds, t, "Título")),
      serviceIds: p.services.map((s) => idOf(serviceIds, s, "Servicio")),
    });

    const data = {
      lastName: input.lastName,
      firstName: input.firstName,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      licenseNumber: input.licenseNumber,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      userId: p.userEmail ? idOf(userIds, p.userEmail, "Usuario") : null,
      active: p.deactivation === null,
      deactivatedAt: p.deactivation ? new Date(p.deactivation.at) : null,
      deactivationReason: p.deactivation?.reason ?? null,
      deactivatedById: p.deactivation ? managerId : null,
      createdById: managerId,
    };
    const titles = input.titleIds.map((id) => ({ id }));
    const services = input.serviceIds.map((id) => ({ id }));

    await prisma.professional.upsert({
      where: { licenseNumber: input.licenseNumber },
      create: {
        ...data,
        titles: { connect: titles },
        services: { connect: services },
      },
      update: { ...data, titles: { set: titles }, services: { set: services } },
    });
  }
}

async function seedHealthInsurers(prisma: PrismaClient) {
  // Clave "Obra social|Plan".
  const plans = new Map<string, { id: number; healthInsurerId: number }>();

  for (const { plans: insurerPlans, ...insurer } of HEALTH_INSURERS) {
    const { id: healthInsurerId } = await prisma.healthInsurer.upsert({
      where: { name: insurer.name },
      create: insurer,
      update: insurer,
      select: { id: true },
    });

    for (const plan of insurerPlans) {
      const { id } = await prisma.insurancePlan.upsert({
        where: { healthInsurerId_name: { healthInsurerId, name: plan.name } },
        create: { ...plan, healthInsurerId },
        update: plan,
        select: { id: true },
      });
      plans.set(`${insurer.name}|${plan.name}`, { id, healthInsurerId });
    }
  }

  return plans;
}

async function seedPatients(
  prisma: PrismaClient,
  userIds: Ids,
  plans: Awaited<ReturnType<typeof seedHealthInsurers>>,
) {
  for (const p of PATIENTS) {
    const key = p.coverage && `${p.coverage.insurer}|${p.coverage.plan}`;
    const plan = key ? plans.get(key) : undefined;
    if (key && !plan) {
      throw new Error(`seed-data.ts: Plan "${key}" no existe en el seed.`);
    }
    const insurancePlanId = plan?.id;

    // Mismo schema que el alta desde la UI: si un dato del seed deja de ser
    // válido (ej. un menor sin tutor), el seed falla en vez de sembrarlo.
    const input = createPatientSchema.parse({
      ...p,
      coverageType: p.coverage ? "HEALTH_INSURANCE" : "PRIVATE",
      healthInsurerId: plan?.healthInsurerId,
      insurancePlanId,
      memberNumber: p.coverage?.memberNumber,
      guardianName: p.guardian?.name,
      guardianPhone: p.guardian?.phone,
    });

    const data = {
      lastName: input.lastName,
      firstName: input.firstName,
      gender: input.gender,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      // Igual que `createPatient`: la fecha se guarda a medianoche UTC.
      birthDate: new Date(`${input.birthDate}T00:00:00.000Z`),
      phone: input.phone,
      email: input.email,
      coverageType: input.coverageType,
      guardianName: input.guardianName ?? null,
      guardianPhone: input.guardianPhone ?? null,
      active: true,
      createdById: idOf(userIds, p.createdBy, "Usuario"),
    };

    const { id: patientId } = await prisma.patient.upsert({
      where: {
        documentType_documentNumber: {
          documentType: input.documentType,
          documentNumber: input.documentNumber,
        },
      },
      create: data,
      update: data,
      select: { id: true },
    });

    if (insurancePlanId && input.memberNumber) {
      // Coseguro en 0, igual que el alta desde la UI.
      const coverage = {
        insurancePlanId,
        memberNumber: input.memberNumber,
        copayAmount: 0,
      };
      await prisma.coverage.upsert({
        where: { patientId },
        create: { ...coverage, patientId },
        update: coverage,
      });
    } else {
      await prisma.coverage.deleteMany({ where: { patientId } });
    }
  }
}

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

    const userIds = await seedUsers(prisma, password);

    const { titleIds, serviceIds } = await seedCatalog(prisma);
    console.log(
      `✓ ${TITLES.length} títulos, ${SPECIALTIES.length} especialidades y ${SERVICES.length} servicios`,
    );

    await seedProfessionals(prisma, userIds, titleIds, serviceIds);
    console.log(`✓ ${PROFESSIONALS.length} profesionales`);

    const plans = await seedHealthInsurers(prisma);
    console.log(
      `✓ ${HEALTH_INSURERS.length} obras sociales y ${plans.size} planes`,
    );

    await seedPatients(prisma, userIds, plans);
    console.log(`✓ ${PATIENTS.length} pacientes`);

    console.log(`\nContraseña de todos los usuarios: ${password}`);
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
