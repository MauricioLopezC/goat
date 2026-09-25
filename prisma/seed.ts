// Igual que `prisma.config.ts`: al correr con tsx nadie carga el .env.
import "dotenv/config";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  AppointmentEventType,
  AppointmentStatus,
  ProfessionalEventType,
  Weekday,
} from "../src/generated/prisma/enums";
import { appointmentInstant } from "../src/lib/appointment-slots";
import {
  WEEKDAYS,
  addDays,
  dateToDb,
  getWeekDays,
  parseTime,
  toLocalSlot,
} from "../src/lib/schedule";
import { createPatientSchema } from "../src/lib/validation/patients";
import { createProfessionalSchema } from "../src/lib/validation/professional";
import { createServiceSchema } from "../src/lib/validation/service";
import {
  createAvailabilityExceptionSchema,
  createAvailabilityWindowSchema,
  createHolidaySchema,
} from "../src/lib/validation/availability";
import {
  APPOINTMENTS,
  AVAILABILITY,
  AVAILABILITY_EXCEPTIONS,
  HEALTH_INSURERS,
  HOLIDAYS,
  MANAGER_EMAIL,
  PATIENTS,
  PROFESSIONAL_HISTORY,
  PROFESSIONALS,
  ROOMS,
  SEED_USERS,
  SERVICES,
  SPECIALTIES,
  TITLES,
} from "./seed-data";

// Datos de prueba para lo que ya está implementado: usuarios (HU-01),
// profesionales y su historial (HU-02 y HU-03), agenda, excepciones y
// feriados (HU-05), catálogo de servicios (HU-06), pacientes (HU-07 y HU-08)
// y turnos (HU-09 a HU-12). Los datos están en `seed-data.ts`.
//
// Existe, además, por un problema de arranque: solo un `MANAGER` crea
// usuarios, y una base recién migrada no tiene ninguno.
//
// Es idempotente: cada registro se hace `upsert` por su clave natural, y al
// volver a correrlo los registros del seed vuelven a sus valores sembrados. Lo
// que se cargó desde la UI no se toca.
//
// Excepciones:
// - Las franjas de un profesional se siembran solo si no tiene ninguna, para
//   no pisar la agenda que se armó desde la UI.
// - Los turnos solo se agregan, nunca se actualizan: su historial es inmutable
//   y su estado lo cambian las pruebas. Sus fechas son relativas a la semana de
//   la corrida (ver `seedAppointments`). Las excepciones de agenda, también.
// - El historial de los profesionales se agrega una sola vez: es inmutable.

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
  // Clave: matrícula.
  const ids: Ids = new Map();

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
      // Igual que `deactivateProfessional`: la fecha de baja a las 12:00 UTC.
      deactivatedAt: p.deactivation
        ? new Date(`${p.deactivation.date}T12:00:00.000Z`)
        : null,
      deactivationReason: p.deactivation?.reason ?? null,
      deactivatedById: p.deactivation ? managerId : null,
      updatedById: p.deactivation ? managerId : null,
      createdById: managerId,
    };
    const titles = input.titleIds.map((id) => ({ id }));
    const services = input.serviceIds.map((id) => ({ id }));

    const { id: professionalId } = await prisma.professional.upsert({
      where: { licenseNumber: input.licenseNumber },
      create: {
        ...data,
        titles: { connect: titles },
        services: { connect: services },
      },
      update: { ...data, titles: { set: titles }, services: { set: services } },
      select: { id: true },
    });
    ids.set(input.licenseNumber, professionalId);

    // La baja deja traza en el historial (HU-03). Una sola vez: el historial
    // es inmutable y el seed se puede correr muchas veces.
    if (p.deactivation) {
      const logged = await prisma.professionalEvent.count({
        where: { professionalId, type: ProfessionalEventType.DEACTIVATED },
      });
      if (!logged) {
        await prisma.professionalEvent.create({
          data: {
            professionalId,
            type: ProfessionalEventType.DEACTIVATED,
            reason: p.deactivation.reason,
            changes: { deactivatedAt: p.deactivation.date },
            userId: managerId,
            createdAt: data.deactivatedAt ?? undefined,
          },
        });
      }
    }
  }

  return ids;
}

/// Eventos de `PROFESSIONAL_HISTORY`, cada uno una sola vez (misma clave:
/// profesional, tipo y motivo). Todos los hace el gerente, como en la UI.
async function seedProfessionalHistory(
  prisma: PrismaClient,
  userIds: Ids,
  professionalIds: Ids,
) {
  const managerId = idOf(userIds, MANAGER_EMAIL, "Usuario");
  let created = 0;

  for (const event of PROFESSIONAL_HISTORY) {
    const professionalId = idOf(
      professionalIds,
      event.professional,
      "Profesional",
    );
    const type = ProfessionalEventType[event.type];
    const logged = await prisma.professionalEvent.count({
      where: { professionalId, type, reason: event.reason },
    });
    if (logged) continue;

    await prisma.professionalEvent.create({
      data: {
        professionalId,
        type,
        reason: event.reason,
        changes: event.changes ?? undefined,
        userId: managerId,
        createdAt: new Date(`${event.date}T12:00:00.000Z`),
      },
    });
    created++;
  }

  return created;
}

async function seedSchedule(
  prisma: PrismaClient,
  professionalIds: Ids,
  serviceIds: Ids,
) {
  const roomIds: Ids = new Map();
  for (const room of ROOMS) {
    const { id } = await prisma.room.upsert({
      where: { name: room.name },
      create: room,
      update: room,
      select: { id: true },
    });
    roomIds.set(room.name, id);
  }

  let windows = 0;
  for (const [license, seedWindows] of Object.entries(AVAILABILITY)) {
    const professionalId = idOf(professionalIds, license, "Profesional");
    const offered = PROFESSIONALS.find((p) => p.licenseNumber === license);
    const existing = await prisma.availabilityWindow.count({
      where: { professionalId },
    });
    if (existing) continue;

    for (const { room, services, ...window } of seedWindows) {
      // Mismas reglas que la UI: formato de hora y fin posterior al inicio.
      const input = createAvailabilityWindowSchema.parse({
        ...window,
        professionalId,
        roomId: room ? idOf(roomIds, room, "Consultorio") : null,
        serviceIds: services.map((s) => {
          if (!offered?.services.includes(s)) {
            throw new Error(
              `seed-data.ts: el profesional ${license} no presta "${s}".`,
            );
          }
          return idOf(serviceIds, s, "Servicio");
        }),
      });
      // La restricción de la base rechaza franjas superpuestas.
      await prisma.availabilityWindow.create({
        data: {
          professionalId,
          weekday: input.weekday,
          startMinute: input.startMinute,
          endMinute: input.endMinute,
          roomId: input.roomId,
          services: { connect: input.serviceIds.map((id) => ({ id })) },
        },
      });
      windows++;
    }
  }

  for (const holiday of HOLIDAYS) {
    const input = createHolidaySchema.parse(holiday);
    const date = new Date(`${input.date}T00:00:00.000Z`);
    await prisma.holiday.upsert({
      where: { date },
      create: { date, description: input.description },
      update: { description: input.description },
    });
  }

  return { rooms: roomIds.size, windows };
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
  // Clave: número de documento.
  const ids: Ids = new Map();

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
      updatedById: p.updatedBy ? idOf(userIds, p.updatedBy, "Usuario") : null,
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
    ids.set(input.documentNumber, patientId);

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

  return ids;
}

const DAY_MS = 24 * 60 * 60_000;

/// Fecha (AAAA-MM-DD) del día `weekday` de la semana `week`, contada desde la
/// semana de la corrida.
function seedDate(now: Date, week: number, weekday: Weekday): string {
  const monday = getWeekDays(toLocalSlot(now).date).monday;
  return addDays(monday, week * 7 + WEEKDAYS.indexOf(weekday));
}

/// Si la excepción de agenda (en minutos; nulos = el día entero) pisa el
/// horario de `startMinute` a `endMinute`.
function overlapsException(
  exception: { startMinute: number | null; endMinute: number | null },
  startMinute: number,
  endMinute: number,
) {
  return (
    exception.startMinute === null ||
    exception.endMinute === null ||
    (exception.startMinute < endMinute && startMinute < exception.endMinute)
  );
}

/// Las excepciones de `AVAILABILITY_EXCEPTIONS`, con fechas relativas a la
/// semana de la corrida, como los turnos. Una se saltea si ya existe, si cae en
/// feriado o si pisa un turno programado (por ejemplo, uno dado desde la UI):
/// la misma regla que `createAvailabilityException`.
async function seedExceptions(
  prisma: PrismaClient,
  userIds: Ids,
  professionalIds: Ids,
) {
  const now = new Date();
  const managerId = idOf(userIds, MANAGER_EMAIL, "Usuario");
  const holidays = new Set(HOLIDAYS.map((h) => h.date));
  const result = { created: 0, existing: 0, skipped: 0 };

  for (const x of AVAILABILITY_EXCEPTIONS) {
    const label = `${x.professional} ${x.weekday}`;
    if (
      !(AVAILABILITY[x.professional] ?? []).some((w) => w.weekday === x.weekday)
    ) {
      throw new Error(
        `seed-data.ts: la excepción ${label} cae en un día sin franjas.`,
      );
    }

    const professionalId = idOf(professionalIds, x.professional, "Profesional");
    // Mismas reglas que la UI: día entero o un horario con fin posterior.
    const input = createAvailabilityExceptionSchema.parse({
      professionalId,
      date: seedDate(now, x.week, x.weekday),
      allDay: !x.startTime,
      startTime: x.startTime,
      endTime: x.endTime,
      reason: x.reason,
    });
    if (holidays.has(input.date)) {
      result.skipped++;
      continue;
    }

    const date = dateToDb(input.date);
    const existing = await prisma.availabilityException.count({
      where: {
        professionalId,
        date,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
      },
    });
    if (existing) {
      result.existing++;
      continue;
    }

    const overlapping = await prisma.appointment.count({
      where: {
        professionalId,
        status: AppointmentStatus.SCHEDULED,
        startsAt: {
          lt: appointmentInstant(input.date, input.endMinute ?? 24 * 60),
        },
        endsAt: { gt: appointmentInstant(input.date, input.startMinute ?? 0) },
      },
    });
    if (overlapping) {
      result.skipped++;
      continue;
    }

    await prisma.availabilityException.create({
      data: {
        professionalId,
        date,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        reason: input.reason,
        createdById: managerId,
      },
    });
    result.created++;
  }

  return result;
}

/// Los turnos de `APPOINTMENTS`, desde la semana anterior a la corrida hasta
/// tres semanas después. Uno se saltea si ya existe (mismo profesional y
/// hora), si cae en feriado o en una excepción de agenda, o si pisaría un
/// turno que ocupa el horario del profesional o del paciente (por ejemplo, uno
/// dado desde la UI). Así el seed se puede volver a correr cualquier día sin
/// chocar con la restricción de la base. Para empezar de cero:
/// `npx prisma migrate reset`.
async function seedAppointments(
  prisma: PrismaClient,
  userIds: Ids,
  professionalIds: Ids,
  serviceIds: Ids,
  patientIds: Ids,
) {
  const now = new Date();
  const holidays = new Set(HOLIDAYS.map((h) => h.date));
  const result = { created: 0, existing: 0, skipped: 0 };

  for (const a of APPOINTMENTS) {
    const label = `${a.professional} ${a.weekday} ${a.startTime}`;
    const offered = PROFESSIONALS.find(
      (p) => p.licenseNumber === a.professional,
    );
    if (!offered?.services.includes(a.service)) {
      throw new Error(
        `seed-data.ts: el profesional ${a.professional} no presta "${a.service}".`,
      );
    }
    const service = SERVICES.find((s) => s.name === a.service);
    if (!service)
      throw new Error(
        `seed-data.ts: Servicio "${a.service}" no existe en el seed.`,
      );

    // Igual que la grilla de HU-09: el turno entero dentro de una franja que
    // habilite el servicio.
    const startMinute = parseTime(a.startTime);
    const endMinute = startMinute + service.durationMinutes;
    const fits = (AVAILABILITY[a.professional] ?? []).some(
      (w) =>
        w.weekday === a.weekday &&
        parseTime(w.startTime) <= startMinute &&
        endMinute <= parseTime(w.endTime) &&
        (w.services.length === 0 || w.services.includes(a.service)),
    );
    if (!fits) {
      throw new Error(`seed-data.ts: el turno ${label} queda fuera de franja.`);
    }
    if (
      AVAILABILITY_EXCEPTIONS.some(
        (x) =>
          x.professional === a.professional &&
          x.week === a.week &&
          x.weekday === a.weekday &&
          overlapsException(
            {
              startMinute: x.startTime ? parseTime(x.startTime) : null,
              endMinute: x.endTime ? parseTime(x.endTime) : null,
            },
            startMinute,
            endMinute,
          ),
      )
    ) {
      throw new Error(
        `seed-data.ts: el turno ${label} cae en una excepción de agenda.`,
      );
    }

    const date = seedDate(now, a.week, a.weekday);
    const startsAt = appointmentInstant(date, startMinute);
    const endsAt = new Date(
      startsAt.getTime() + service.durationMinutes * 60_000,
    );
    // Mismas condiciones de tiempo que `closeAppointment`.
    if (
      (a.status === AppointmentStatus.COMPLETED && startsAt > now) ||
      (a.status === AppointmentStatus.EXPIRED && endsAt > now)
    ) {
      throw new Error(
        `seed-data.ts: el turno ${label} todavía no pasó y no puede quedar ${a.status}.`,
      );
    }
    const cancelled = a.status === AppointmentStatus.CANCELLED;
    if (cancelled && (!a.reason || !a.requestedBy)) {
      throw new Error(
        `seed-data.ts: el turno cancelado ${label} necesita motivo y quién lo pidió.`,
      );
    }

    if (holidays.has(date)) {
      result.skipped++;
      continue;
    }

    const professionalId = idOf(professionalIds, a.professional, "Profesional");
    const patientId = idOf(patientIds, a.patient, "Paciente");

    // Una excepción cargada desde la UI también deja el horario sin atención.
    const exceptions = await prisma.availabilityException.findMany({
      where: { professionalId, date: dateToDb(date) },
      select: { startMinute: true, endMinute: true },
    });
    if (exceptions.some((x) => overlapsException(x, startMinute, endMinute))) {
      result.skipped++;
      continue;
    }

    const existing = await prisma.appointment.count({
      where: { professionalId, startsAt },
    });
    if (existing) {
      result.existing++;
      continue;
    }

    const occupies =
      a.status === AppointmentStatus.SCHEDULED ||
      a.status === AppointmentStatus.COMPLETED;
    if (occupies) {
      const overlapping = await prisma.appointment.count({
        where: {
          OR: [{ professionalId }, { patientId }],
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
          },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (overlapping) {
        result.skipped++;
        continue;
      }
    }

    // Fechas verosímiles para la traza: el turno se dio una semana antes (o
    // ahora, si eso cae en el futuro), se canceló la víspera y se cerró al
    // terminar.
    const userId = idOf(userIds, a.createdBy, "Usuario");
    const createdAt = new Date(
      Math.min(startsAt.getTime() - 7 * DAY_MS, now.getTime()),
    );
    const changedAt = cancelled
      ? new Date(Math.min(startsAt.getTime() - DAY_MS, now.getTime()))
      : endsAt;
    const eventType = {
      [AppointmentStatus.SCHEDULED]: null,
      [AppointmentStatus.COMPLETED]: AppointmentEventType.COMPLETED,
      [AppointmentStatus.EXPIRED]: AppointmentEventType.EXPIRED,
      [AppointmentStatus.CANCELLED]: AppointmentEventType.CANCELLED,
    }[a.status];

    await prisma.appointment.create({
      data: {
        patientId,
        professionalId,
        serviceId: idOf(serviceIds, a.service, "Servicio"),
        startsAt,
        endsAt,
        status: a.status,
        notes: a.notes ?? null,
        createdById: userId,
        createdAt,
        updatedAt: eventType ? changedAt : createdAt,
        events: eventType
          ? {
              create: {
                type: eventType,
                reason: a.reason ?? null,
                requestedBy: a.requestedBy ?? null,
                userId,
                createdAt: changedAt,
              },
            }
          : undefined,
      },
    });
    result.created++;
  }

  return result;
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

    const professionalIds = await seedProfessionals(
      prisma,
      userIds,
      titleIds,
      serviceIds,
    );
    const history = await seedProfessionalHistory(
      prisma,
      userIds,
      professionalIds,
    );
    console.log(
      `✓ ${PROFESSIONALS.length} profesionales (${history} cambios nuevos en su historial)`,
    );

    const schedule = await seedSchedule(prisma, professionalIds, serviceIds);
    console.log(
      `✓ ${schedule.rooms} consultorios, ${schedule.windows} franjas nuevas y ${HOLIDAYS.length} feriados`,
    );

    const exceptions = await seedExceptions(prisma, userIds, professionalIds);
    console.log(
      `✓ ${exceptions.created} excepciones de agenda nuevas (${exceptions.existing} ya estaban, ${exceptions.skipped} salteadas por feriado o turno programado)`,
    );

    const plans = await seedHealthInsurers(prisma);
    console.log(
      `✓ ${HEALTH_INSURERS.length} obras sociales y ${plans.size} planes`,
    );

    const patientIds = await seedPatients(prisma, userIds, plans);
    console.log(`✓ ${PATIENTS.length} pacientes`);

    const appointments = await seedAppointments(
      prisma,
      userIds,
      professionalIds,
      serviceIds,
      patientIds,
    );
    console.log(
      `✓ ${appointments.created} turnos nuevos (${appointments.existing} ya estaban, ${appointments.skipped} salteados por feriado u horario ocupado)`,
    );

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
