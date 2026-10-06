// Verificación de HU-14 sobre PostgreSQL local migrado. Crea únicamente
// fixtures identificadas por UUID y elimina sus propios registros al terminar.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  createHoliday,
  deleteHoliday,
  listHolidays,
} from "../src/lib/dal/availability";
import { cancelAppointment } from "../src/lib/dal/appointments";
import { DomainError } from "../src/lib/actions";
import { Role } from "../src/generated/prisma/enums";
import { appointmentInstant } from "../src/lib/appointment-slots";
import {
  addDays,
  dateToDb,
  toLocalSlot,
  type AffectedAppointment,
} from "../src/lib/schedule";
import type { Actor } from "../src/lib/dal/auth";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Esta verificación solo usa PostgreSQL local.",
  );
  assert.notEqual(process.env.NODE_ENV, "production");
  const tag = `HU14-${randomUUID()}`;
  const users: number[] = [],
    patients: number[] = [],
    professionals: number[] = [],
    services: number[] = [];
  let passed = 0;
  async function verify(label: string, run: () => Promise<void>) {
    await run();
    passed++;
    console.log(`OK ${label}`);
  }
  async function rejects(
    run: () => Promise<unknown>,
    code: string,
    check?: (error: DomainError) => void,
  ) {
    await assert.rejects(run, (error: unknown) => {
      if (!(error instanceof DomainError) || error.code !== code) return false;
      check?.(error);
      return true;
    });
  }

  /// Días sin cierre ni turnos programados, lejos de los datos del seed.
  async function freeDates(count: number) {
    const dates: string[] = [];
    let date = addDays(toLocalSlot(new Date()).date, 400);
    while (dates.length < count) {
      const busy =
        (await prisma.holiday.findFirst({
          where: { startDate: dateToDb(date) },
        })) ||
        (await prisma.appointment.findFirst({
          where: {
            status: "SCHEDULED",
            startsAt: {
              gte: appointmentInstant(date, 0),
              lt: appointmentInstant(date, 1440),
            },
          },
        }));
      if (!busy) dates.push(date);
      date = addDays(date, 1);
    }
    return dates;
  }

  try {
    const actors: Actor[] = [];
    for (const role of [Role.MANAGER, Role.RECEPTIONIST, Role.PROFESSIONAL]) {
      const user = await prisma.user.create({
        data: {
          email: `${tag}-${role}@example.invalid`,
          passwordHash: "verification-disabled-login",
          firstName: "Prueba",
          lastName: tag,
          role,
        },
      });
      users.push(user.id);
      actors.push(user);
    }
    const [manager, receptionist, professionalActor] = actors;
    const service = await prisma.service.create({
      data: { name: `${tag}-30`, durationMinutes: 30 },
    });
    services.push(service.id);
    const patient = await prisma.patient.create({
      data: {
        firstName: "Paciente",
        lastName: tag,
        gender: "OTHER",
        documentType: "PASSPORT",
        documentNumber: `${tag}-patient`,
        birthDate: dateToDb("2000-01-01"),
        phone: "3875550000",
        email: `${tag}@example.invalid`,
        coverageType: "PRIVATE",
        createdById: manager.id,
      },
    });
    patients.push(patient.id);
    const professional = await prisma.professional.create({
      data: {
        firstName: "Profesional",
        lastName: tag,
        documentType: "PASSPORT",
        documentNumber: `${tag}-professional`,
        licenseNumber: tag,
        createdById: manager.id,
        services: { connect: { id: service.id } },
      },
    });
    professionals.push(professional.id);

    const [freeDate, busyDate, managerDate] = await freeDates(3);
    const holidayInput = (date: string) => ({ date, description: tag });

    await verify("el profesional no carga ni quita cierres", async () => {
      await rejects(
        () => createHoliday(holidayInput(freeDate), professionalActor),
        "FORBIDDEN",
      );
      const holiday = await createHoliday(holidayInput(freeDate), manager);
      await rejects(
        () => deleteHoliday({ id: holiday.id }, professionalActor),
        "FORBIDDEN",
      );
      // Sí los consulta (ve el día pintado en su agenda).
      await listHolidays(1, professionalActor);
      await deleteHoliday({ id: holiday.id }, manager);
    });

    let receptionistHoliday = 0;
    await verify(
      "mesa de entradas cierra el centro y queda registrado quién y cuándo",
      async () => {
        const before = new Date();
        const holiday = await createHoliday(
          holidayInput(freeDate),
          receptionist,
        );
        receptionistHoliday = holiday.id;
        assert.equal(holiday.date, freeDate);
        assert.equal(holiday.description, tag);
        const stored = await prisma.holiday.findUniqueOrThrow({
          where: { id: holiday.id },
        });
        assert.equal(stored.createdById, receptionist.id);
        assert.ok(stored.createdAt.getTime() >= before.getTime() - 1000);
      },
    );

    await verify("no hay dos cierres el mismo día", async () => {
      await rejects(
        () => createHoliday(holidayInput(freeDate), manager),
        "DUPLICATE",
        (error) => assert.ok(error.fieldErrors?.date?.length),
      );
    });

    await verify("no se cierra un día pasado", async () => {
      await rejects(
        () =>
          createHoliday(
            holidayInput(addDays(toLocalSlot(new Date()).date, -1)),
            receptionist,
          ),
        "VALIDATION",
      );
    });

    await verify(
      "mesa de entradas quita el cierre y el día vuelve a habilitarse",
      async () => {
        await deleteHoliday({ id: receptionistHoliday }, receptionist);
        assert.equal(
          await prisma.holiday.count({ where: { id: receptionistHoliday } }),
          0,
        );
        await rejects(
          () => deleteHoliday({ id: receptionistHoliday }, receptionist),
          "NOT_FOUND",
        );
      },
    );

    await verify(
      "un día con turnos programados no se cierra y lista los afectados con teléfono",
      async () => {
        const startsAt = appointmentInstant(busyDate, 600);
        const appointment = await prisma.appointment.create({
          data: {
            patientId: patient.id,
            professionalId: professional.id,
            serviceId: service.id,
            startsAt,
            endsAt: new Date(startsAt.getTime() + 30 * 60_000),
            createdById: receptionist.id,
          },
        });
        await rejects(
          () => createHoliday(holidayInput(busyDate), receptionist),
          "FUTURE_APPOINTMENTS",
          (error) => {
            const affected = error.meta?.appointments as AffectedAppointment[];
            assert.equal(affected.length, 1);
            assert.equal(affected[0].id, appointment.id);
            assert.equal(affected[0].startsAt, startsAt.toISOString());
            assert.equal(affected[0].patientPhone, "3875550000");
            assert.equal(affected[0].patientName, `${tag}, Paciente`);
            assert.equal(affected[0].professionalName, `${tag}, Profesional`);
            assert.equal(affected[0].serviceName, service.name);
          },
        );
        assert.equal(
          await prisma.holiday.count({
            where: { startDate: dateToDb(busyDate) },
          }),
          0,
        );

        // Con el turno cancelado, el cierre se vuelve a intentar y se crea.
        await cancelAppointment(
          {
            appointmentId: appointment.id,
            reason: "Prueba HU-14",
            requestedBy: "el centro",
          },
          receptionist,
        );
        const holiday = await createHoliday(
          holidayInput(busyDate),
          receptionist,
        );
        assert.equal(holiday.date, busyDate);
      },
    );

    await verify("el gerente sigue cargando y quitando cierres", async () => {
      const holiday = await createHoliday(holidayInput(managerDate), manager);
      await deleteHoliday({ id: holiday.id }, manager);
    });

    console.log(
      `${passed} grupos de verificaciones HU-14 PostgreSQL correctos.`,
    );
  } finally {
    await prisma.appointment.deleteMany({
      where: { createdById: { in: users } },
    });
    await prisma.holiday.deleteMany({ where: { description: tag } });
    await prisma.professional.deleteMany({
      where: { id: { in: professionals } },
    });
    await prisma.patient.deleteMany({ where: { id: { in: patients } } });
    await prisma.service.deleteMany({ where: { id: { in: services } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
