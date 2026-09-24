// Verificación de HU-09 sobre PostgreSQL local migrado. Crea únicamente
// fixtures identificadas por UUID y elimina sus propios registros al terminar.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  createAppointment,
  listAvailableSlots,
  getAppointmentOptions,
  getAppointment,
  listAppointments,
} from "../src/lib/dal/appointments";
import { DomainError } from "../src/lib/actions";
import { Role } from "../src/generated/prisma/enums";
import {
  appointmentInstant,
  appointmentDateBounds,
} from "../src/lib/appointment-slots";
import { dateToDb, toLocalSlot } from "../src/lib/schedule";
import type { Actor } from "../src/lib/dal/auth";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Esta verificación solo usa PostgreSQL local.",
  );
  assert.notEqual(process.env.NODE_ENV, "production");
  const tag = `HU09-${randomUUID()}`;
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
  async function rejects(run: () => Promise<unknown>, code: string) {
    await assert.rejects(
      run,
      (error: unknown) => error instanceof DomainError && error.code === code,
    );
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
    const longService = await prisma.service.create({
      data: { name: `${tag}-60`, durationMinutes: 60 },
    });
    services.push(longService.id);
    for (let i = 0; i < 2; i++) {
      const patient = await prisma.patient.create({
        data: {
          firstName: "Paciente",
          lastName: `${tag}-${i}`,
          gender: "OTHER",
          documentType: "PASSPORT",
          documentNumber: `${tag}-patient-${i}`,
          birthDate: dateToDb("2000-01-01"),
          phone: "0000000000",
          email: `${tag}-${i}@example.invalid`,
          coverageType: "PRIVATE",
          createdById: manager.id,
        },
      });
      patients.push(patient.id);
      const professional = await prisma.professional.create({
        data: {
          firstName: "Profesional",
          lastName: `${tag}-${i}`,
          documentType: "PASSPORT",
          documentNumber: `${tag}-professional-${i}`,
          licenseNumber: `${tag}-${i}`,
          createdById: manager.id,
          userId: i === 0 ? professionalActor.id : null,
          services: { connect: services.map((id) => ({ id })) },
        },
      });
      professionals.push(professional.id);
    }
    let day = new Date();
    day.setUTCDate(day.getUTCDate() + 1);
    while (
      await prisma.holiday.findUnique({
        where: { date: dateToDb(toLocalSlot(day).date) },
      })
    )
      day = new Date(day.getTime() + 86_400_000);
    const date = toLocalSlot(day).date;
    const weekday = toLocalSlot(appointmentInstant(date, 0)).weekday;
    for (const professionalId of professionals)
      await prisma.availabilityWindow.create({
        data: { professionalId, weekday, startMinute: 540, endMinute: 720 },
      });
    const input = {
      patientId: patients[0],
      professionalId: professionals[0],
      serviceId: service.id,
      date,
      startTime: "09:00",
      notes: "Prueba HU-09",
    };

    await verify(
      "profesionales activos, asociados y con franjas; búsqueda de paciente",
      async () => {
        const options = await getAppointmentOptions(
          { query: tag, patientId: patients[0], serviceId: service.id },
          receptionist,
        );
        assert.equal(options.patients.length, 2);
        assert.equal(options.professionals.length, 2);
        await prisma.professional.update({
          where: { id: professionals[1] },
          data: { active: false },
        });
        assert.equal(
          (await getAppointmentOptions({ serviceId: service.id }, manager))
            .professionals.length,
          1,
        );
        await rejects(
          () =>
            createAppointment(
              { ...input, professionalId: professionals[1] },
              receptionist,
            ),
          "NOT_FOUND",
        );
        await prisma.professional.update({
          where: { id: professionals[1] },
          data: { active: true },
        });
      },
    );
    await verify("duración variable y horas fuera de franja", async () => {
      assert.equal((await listAvailableSlots(input, manager)).length, 6);
      assert.equal(
        (
          await listAvailableSlots(
            { ...input, serviceId: longService.id },
            manager,
          )
        ).length,
        3,
      );
      await rejects(
        () =>
          createAppointment(
            { ...input, serviceId: longService.id, startTime: "11:30" },
            manager,
          ),
        "OUTSIDE_AVAILABILITY_WINDOW",
      );
    });
    await verify("pasado, fecha inválida y límite de dos meses", async () => {
      await rejects(
        () => createAppointment({ ...input, date: "2000-01-01" }, manager),
        "VALIDATION",
      );
      await rejects(
        () => createAppointment({ ...input, date: "2026-02-30" }, manager),
        "VALIDATION",
      );
      const max = appointmentDateBounds().max;
      const beyond = new Date(`${max}T12:00:00Z`);
      beyond.setUTCDate(beyond.getUTCDate() + 1);
      await rejects(
        () =>
          listAvailableSlots(
            { ...input, date: beyond.toISOString().slice(0, 10) },
            manager,
          ),
        "VALIDATION",
      );
    });
    await verify("ausencia parcial, completa y feriado", async () => {
      const exception = await prisma.availabilityException.create({
        data: {
          professionalId: professionals[0],
          date: dateToDb(date),
          startMinute: 555,
          endMinute: 585,
          reason: tag,
          createdById: manager.id,
        },
      });
      assert.equal((await listAvailableSlots(input, manager)).length, 4);
      await rejects(
        () => createAppointment(input, manager),
        "OUTSIDE_AVAILABILITY_WINDOW",
      );
      await prisma.availabilityException.update({
        where: { id: exception.id },
        data: { startMinute: null, endMinute: null },
      });
      assert.equal((await listAvailableSlots(input, manager)).length, 0);
      await prisma.availabilityException.delete({
        where: { id: exception.id },
      });
      const holiday = await prisma.holiday.create({
        data: { date: dateToDb(date), description: tag },
      });
      try {
        assert.equal((await listAvailableSlots(input, manager)).length, 0);
        await rejects(
          () => createAppointment(input, manager),
          "OUTSIDE_AVAILABILITY_WINDOW",
        );
      } finally {
        await prisma.holiday.delete({ where: { id: holiday.id } });
      }
    });
    await verify(
      "creación, resumen, calendario, autoría y bloqueo del horario",
      async () => {
        const created = await createAppointment(input, receptionist);
        const summary = await getAppointment(created.id, manager);
        assert.equal(summary.status, "SCHEDULED");
        assert.equal(summary.createdBy.id, receptionist.id);
        assert.equal(summary.notes, input.notes);
        assert.equal(
          summary.endsAt.getTime() - summary.startsAt.getTime(),
          30 * 60_000,
        );
        assert.ok(
          (await listAppointments(date, manager)).some(
            (a) => a.id === created.id,
          ),
        );
        assert.ok(
          (await listAppointments(date, professionalActor)).some(
            (a) => a.id === created.id,
          ),
        );
        assert.ok(
          !(await listAvailableSlots(input, manager)).some(
            (s) => s.startTime === "09:00",
          ),
        );
        await rejects(
          () => createAppointment(input, manager),
          "APPOINTMENT_OVERLAP",
        );
        await rejects(
          () =>
            createAppointment(
              { ...input, professionalId: professionals[1] },
              manager,
            ),
          "PATIENT_APPOINTMENT_OVERLAP",
        );
        assert.ok(
          !(
            await listAvailableSlots(
              { ...input, professionalId: professionals[1] },
              manager,
            )
          ).some((s) => s.startTime === "09:00"),
        );
      },
    );
    await verify(
      "profesional no asigna ni consulta turnos ajenos",
      async () => {
        await rejects(
          () => createAppointment(input, professionalActor),
          "FORBIDDEN",
        );
        await rejects(
          () => getAppointmentOptions({}, professionalActor),
          "FORBIDDEN",
        );
        await rejects(
          () => listAvailableSlots(input, professionalActor),
          "FORBIDDEN",
        );
        const other = await createAppointment(
          {
            ...input,
            professionalId: professionals[1],
            patientId: patients[1],
          },
          manager,
        );
        await rejects(
          () => getAppointment(other.id, professionalActor),
          "NOT_FOUND",
        );
        assert.ok(
          !(await listAppointments(date, professionalActor)).some(
            (a) => a.id === other.id,
          ),
        );
      },
    );
    await verify(
      "dos usuarios reservando al mismo profesional: solo uno gana",
      async () => {
        const results = await Promise.allSettled([
          createAppointment({ ...input, startTime: "10:00" }, manager),
          createAppointment(
            { ...input, patientId: patients[1], startTime: "10:00" },
            receptionist,
          ),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const failure = results.find((r) => r.status === "rejected");
        assert.ok(
          failure?.status === "rejected" &&
            failure.reason instanceof DomainError &&
            failure.reason.code === "APPOINTMENT_OVERLAP",
        );
      },
    );
    await verify(
      "mismo paciente con dos profesionales simultáneos: solo uno gana",
      async () => {
        const results = await Promise.allSettled(
          professionals.map((professionalId) =>
            createAppointment(
              { ...input, professionalId, startTime: "11:00" },
              manager,
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const failure = results.find((r) => r.status === "rejected");
        assert.ok(
          failure?.status === "rejected" &&
            failure.reason instanceof DomainError &&
            failure.reason.code === "PATIENT_APPOINTMENT_OVERLAP",
        );
      },
    );
    await verify(
      "PostgreSQL rechaza ambos solapamientos aun sin pasar por DAL",
      async () => {
        const occupied = await prisma.appointment.findFirstOrThrow({
          where: {
            professionalId: professionals[0],
            startsAt: appointmentInstant(date, 600),
          },
        });
        for (const [professionalId, patientId, constraint] of [
          [
            professionals[0],
            patients.find((id) => id !== occupied.patientId)!,
            "Appointment_professional_no_overlap",
          ],
          [
            professionals[1],
            occupied.patientId,
            "Appointment_patient_no_overlap",
          ],
        ] as const)
          await assert.rejects(
            () =>
              prisma.appointment.create({
                data: {
                  patientId,
                  professionalId,
                  serviceId: service.id,
                  startsAt: appointmentInstant(date, 600),
                  endsAt: appointmentInstant(date, 630),
                  createdById: manager.id,
                },
              }),
            (error: unknown) =>
              error instanceof Error && error.message.includes(constraint),
          );
      },
    );
    await verify(
      "servicio/paciente inactivo y servicio restringido por franja",
      async () => {
        await prisma.patient.update({
          where: { id: patients[0] },
          data: { active: false },
        });
        await rejects(
          () => createAppointment({ ...input, startTime: "11:30" }, manager),
          "NOT_FOUND",
        );
        await prisma.patient.update({
          where: { id: patients[0] },
          data: { active: true },
        });
        await prisma.service.update({
          where: { id: service.id },
          data: { active: false },
        });
        await rejects(
          () => createAppointment({ ...input, startTime: "11:30" }, manager),
          "NOT_FOUND",
        );
        await prisma.service.update({
          where: { id: service.id },
          data: { active: true },
        });
        const window = await prisma.availabilityWindow.findFirstOrThrow({
          where: { professionalId: professionals[0] },
        });
        await prisma.availabilityWindow.update({
          where: { id: window.id },
          data: { services: { connect: { id: longService.id } } },
        });
        assert.equal((await listAvailableSlots(input, manager)).length, 0);
        await rejects(
          () => createAppointment({ ...input, startTime: "11:30" }, manager),
          "OUTSIDE_AVAILABILITY_WINDOW",
        );
        assert.ok(
          !(
            await getAppointmentOptions({ serviceId: service.id }, manager)
          ).professionals.some((p) => p.id === professionals[0]),
        );
      },
    );
    console.log(`${passed} grupos de verificaciones PostgreSQL correctos.`);
  } finally {
    await prisma.appointment.deleteMany({
      where: { createdById: { in: users } },
    });
    await prisma.availabilityException.deleteMany({
      where: { createdById: { in: users } },
    });
    await prisma.holiday.deleteMany({ where: { description: tag } });
    await prisma.availabilityWindow.deleteMany({
      where: { professionalId: { in: professionals } },
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
