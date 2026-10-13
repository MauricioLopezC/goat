// Verificación de HU-14 sobre PostgreSQL local migrado. Crea únicamente
// fixtures identificadas por UUID y elimina sus propios registros al terminar.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  countAffectedAppointments,
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
          where: {
            startDate: { lte: dateToDb(date) },
            endDate: { gte: dateToDb(date) },
          },
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

  async function freeConsecutiveDates(count: number): Promise<string[]> {
    let startCandidate = addDays(toLocalSlot(new Date()).date, 450);
    while (true) {
      const candidateList: string[] = [];
      let allFree = true;
      for (let i = 0; i < count; i++) {
        const d = addDays(startCandidate, i);
        candidateList.push(d);
        const busy =
          (await prisma.holiday.findFirst({
            where: {
              startDate: { lte: dateToDb(d) },
              endDate: { gte: dateToDb(d) },
            },
          })) ||
          (await prisma.appointment.findFirst({
            where: {
              status: "SCHEDULED",
              startsAt: {
                gte: appointmentInstant(d, 0),
                lt: appointmentInstant(d, 1440),
              },
            },
          }));
        if (busy) {
          allFree = false;
          break;
        }
      }
      if (allFree) return candidateList;
      startCandidate = addDays(startCandidate, 1);
    }
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

    // ─────────────────────── HU-23: Rangos y tramos horarios ───────────────────────

    const [rangeStart, rangeMid, rangeEnd] = await freeConsecutiveDates(3);

    await verify(
      "cierre por rango de varios días y eliminación desde un día intermedio (HU-23)",
      async () => {
        // Crear cierre multi-día
        const rangeHoliday = await createHoliday(
          {
            startDate: rangeStart,
            endDate: rangeEnd,
            description: `${tag}-range`,
          },
          receptionist,
        );
        assert.equal(rangeHoliday.startDate, rangeStart);
        assert.equal(rangeHoliday.endDate, rangeEnd);

        // Se lista en los cierres futuros
        const firstPage = await listHolidays(1, receptionist);
        const lastPage = await listHolidays(firstPage.pageCount, receptionist);
        const inList = [...firstPage.items, ...lastPage.items].find(
          (h) => h.id === rangeHoliday.id,
        );
        assert.ok(inList, "El cierre por rango debe figurar en listHolidays");
        assert.equal(inList.startDate, rangeStart);
        assert.equal(inList.endDate, rangeEnd);

        // Intento de superposición parcial o total es rechazado con DUPLICATE
        await rejects(
          () =>
            createHoliday(
              {
                date: rangeMid,
                description: `${tag}-mid-overlap`,
              },
              manager,
            ),
          "DUPLICATE",
        );

        await rejects(
          () =>
            createHoliday(
              {
                startDate: rangeMid,
                endDate: addDays(rangeEnd, 1),
                description: `${tag}-span-overlap`,
              },
              manager,
            ),
          "DUPLICATE",
        );

        // [P2] Quitar el cierre consultando desde un día intermedio elimina el rango completo
        const foundIntermediate = await prisma.holiday.findFirst({
          where: {
            startDate: { lte: dateToDb(rangeMid) },
            endDate: { gte: dateToDb(rangeMid) },
          },
        });
        assert.ok(foundIntermediate);
        assert.equal(foundIntermediate.id, rangeHoliday.id);

        await deleteHoliday({ id: foundIntermediate.id }, receptionist);

        // Verifica que los 3 días quedan libres
        const countRemaining = await prisma.holiday.count({
          where: {
            OR: [
              {
                startDate: { lte: dateToDb(rangeStart) },
                endDate: { gte: dateToDb(rangeStart) },
              },
              {
                startDate: { lte: dateToDb(rangeMid) },
                endDate: { gte: dateToDb(rangeMid) },
              },
              {
                startDate: { lte: dateToDb(rangeEnd) },
                endDate: { gte: dateToDb(rangeEnd) },
              },
            ],
          },
        });
        assert.equal(
          countRemaining,
          0,
          "Todo el período debe quedar libre tras borrar el cierre",
        );
      },
    );

    const [partialDate] = await freeDates(1);

    await verify(
      "cierre por tramo horario y detección de turnos en franja (HU-23)",
      async () => {
        // Crear turno en la tarde: 14:00 - 14:30 (minutos 840 - 870)
        const startsAtAfternoon = appointmentInstant(partialDate, 840);
        const afternoonAppt = await prisma.appointment.create({
          data: {
            patientId: patient.id,
            professionalId: professional.id,
            serviceId: service.id,
            startsAt: startsAtAfternoon,
            endsAt: new Date(startsAtAfternoon.getTime() + 30 * 60_000),
            createdById: receptionist.id,
          },
        });

        // Intentar cerrar el tramo de la mañana: 08:00 - 12:00 (minutos 480 - 720).
        // No colisiona con el turno de la tarde, por lo que DEBE permitir crearlo.
        const morningClosure = await createHoliday(
          {
            date: partialDate,
            startMinute: 480,
            endMinute: 720,
            description: `${tag}-morning`,
          },
          receptionist,
        );
        assert.equal(morningClosure.startMinute, 480);
        assert.equal(morningClosure.endMinute, 720);

        // Superposición de tramo en el mismo día debe ser rechazada
        await rejects(
          () =>
            createHoliday(
              {
                date: partialDate,
                startMinute: 600,
                endMinute: 800,
                description: `${tag}-overlap-slot`,
              },
              manager,
            ),
          "DUPLICATE",
        );

        // Otro tramo independiente en el mismo día (ej. 16:00 - 18:00 / 960 - 1080) se permite
        const eveningClosure = await createHoliday(
          {
            date: partialDate,
            startMinute: 960,
            endMinute: 1080,
            description: `${tag}-evening`,
          },
          receptionist,
        );
        assert.equal(eveningClosure.startMinute, 960);
        await deleteHoliday({ id: eveningClosure.id }, receptionist);

        // Intentar cerrar un tramo que incluye las 14:00 (13:00 - 16:00 / 780 - 960):
        // Debe ser rechazado con FUTURE_APPOINTMENTS por el turno de la tarde.
        await rejects(
          () =>
            createHoliday(
              {
                date: partialDate,
                startMinute: 780,
                endMinute: 960,
                description: `${tag}-afternoon-closure`,
              },
              receptionist,
            ),
          "FUTURE_APPOINTMENTS",
          (error) => {
            const affected = error.meta?.appointments as AffectedAppointment[];
            assert.equal(affected.length, 1);
            assert.equal(affected[0].id, afternoonAppt.id);
          },
        );

        // Limpiar el cierre de la mañana y el turno de la tarde
        await deleteHoliday({ id: morningClosure.id }, receptionist);
        await prisma.appointment.delete({ where: { id: afternoonAppt.id } });
      },
    );

    const [compatDate] = await freeDates(1);

    await verify(
      "compatibilidad: creación de cierre con contrato legacy { date, description } sin allDay (HU-23)",
      async () => {
        // Objeto como en HOLIDAYS del seed: { date, description }
        const legacyHoliday = await createHoliday(
          {
            date: compatDate,
            description: `${tag}-legacy`,
          },
          receptionist,
        );
        assert.equal(legacyHoliday.startDate, compatDate);
        assert.equal(legacyHoliday.endDate, compatDate);
        assert.equal(legacyHoliday.startMinute, null);
        assert.equal(legacyHoliday.endMinute, null);

        await deleteHoliday({ id: legacyHoliday.id }, receptionist);
      },
    );

    const [affectedCheckDate] = await freeDates(1);

    await verify(
      "cálculo previo de turnos afectados con countAffectedAppointments (HU-23)",
      async () => {
        // Sin turnos, conteo es 0
        const zeroCount = await countAffectedAppointments(
          {
            startDate: affectedCheckDate,
            endDate: affectedCheckDate,
            startMinute: 480,
            endMinute: 720,
          },
          receptionist,
        );
        assert.equal(zeroCount, 0);

        // Con turno a las 10:00 (600)
        const startsAt = appointmentInstant(affectedCheckDate, 600);
        const appt = await prisma.appointment.create({
          data: {
            patientId: patient.id,
            professionalId: professional.id,
            serviceId: service.id,
            startsAt,
            endsAt: new Date(startsAt.getTime() + 30 * 60_000),
            createdById: receptionist.id,
          },
        });

        const counted = await countAffectedAppointments(
          {
            startDate: affectedCheckDate,
            endDate: affectedCheckDate,
            startMinute: 480,
            endMinute: 720,
          },
          receptionist,
        );
        assert.equal(counted, 1);

        const outsideCount = await countAffectedAppointments(
          {
            startDate: affectedCheckDate,
            endDate: affectedCheckDate,
            startMinute: 720,
            endMinute: 900,
          },
          receptionist,
        );
        assert.equal(outsideCount, 0);

        await prisma.appointment.delete({ where: { id: appt.id } });
      },
    );

    console.log(
      `${passed} grupos de verificaciones HU-14 / HU-23 PostgreSQL correctos.`,
    );
  } finally {
    await prisma.appointment.deleteMany({
      where: { createdById: { in: users } },
    });
    await prisma.holiday.deleteMany({
      where: { description: { startsWith: tag } },
    });
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
