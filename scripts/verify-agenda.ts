import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { getProfessionalAgenda } from "../src/lib/dal/appointments";
import { DomainError } from "../src/lib/actions";
import {
  AppointmentStatus,
  DocumentType,
  Gender,
  Role,
  Weekday,
} from "../src/generated/prisma/enums";
import { appointmentInstant } from "../src/lib/appointment-slots";
import type { Actor } from "../src/lib/dal/auth";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Esta verificación solo usa PostgreSQL local.",
  );
  assert.notEqual(process.env.NODE_ENV, "production");

  const tag = `HU12-${randomUUID()}`;
  const users: number[] = [];
  const patients: number[] = [];
  const professionals: number[] = [];
  const services: number[] = [];
  const appointments: number[] = [];

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
    // 1. Usuarios: Manager, Doctor 1, Doctor 2
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

    const doc1User = await prisma.user.create({
      data: {
        email: `${tag}-doc1@example.invalid`,
        passwordHash: "hash",
        firstName: "Julia",
        lastName: `Doc1-${tag}`,
        role: Role.PROFESSIONAL,
      },
    });
    users.push(doc1User.id);
    const doc1Actor: Actor = doc1User;

    const doc2User = await prisma.user.create({
      data: {
        email: `${tag}-doc2@example.invalid`,
        passwordHash: "hash",
        firstName: "Ricardo",
        lastName: `Doc2-${tag}`,
        role: Role.PROFESSIONAL,
      },
    });
    users.push(doc2User.id);

    // 2. Título profesional
    const title = await prisma.professionalTitle.findFirstOrThrow();

    // 3. Profesionales asociados
    const doc1 = await prisma.professional.create({
      data: {
        userId: doc1User.id,
        firstName: doc1User.firstName,
        lastName: doc1User.lastName,
        documentType: DocumentType.DNI,
        documentNumber: "11111111",
        licenseNumber: `L1-${tag.slice(0, 4)}`,
        createdById: managerUser.id,
        titles: { connect: { id: title.id } },
      },
    });
    professionals.push(doc1.id);

    const doc2 = await prisma.professional.create({
      data: {
        userId: doc2User.id,
        firstName: doc2User.firstName,
        lastName: doc2User.lastName,
        documentType: DocumentType.DNI,
        documentNumber: "22222222",
        licenseNumber: `L2-${tag.slice(0, 4)}`,
        createdById: managerUser.id,
        titles: { connect: { id: title.id } },
      },
    });
    professionals.push(doc2.id);

    // 4. Servicio
    const service = await prisma.service.create({
      data: {
        name: `Consulta-${tag}`,
        durationMinutes: 30,
        active: true,
        specialty: {
          connect: { id: (await prisma.specialty.findFirstOrThrow()).id },
        },
      },
    });
    services.push(service.id);

    await prisma.professional.update({
      where: { id: doc1.id },
      data: { services: { connect: { id: service.id } } },
    });

    // 5. Franja horaria para Doc1 (Lunes 09:00 a 13:00)
    await prisma.availabilityWindow.create({
      data: {
        professionalId: doc1.id,
        weekday: Weekday.MONDAY,
        startMinute: 540,
        endMinute: 780,
      },
    });

    // 6. Paciente
    const patient = await prisma.patient.create({
      data: {
        firstName: "Carlos",
        lastName: "Test",
        documentType: DocumentType.DNI,
        documentNumber: `DNI-${tag.slice(0, 7)}`,
        birthDate: new Date("1990-01-01T00:00:00Z"),
        gender: Gender.MALE,
        phone: "3875551234",
        email: `${tag}@example.invalid`,
        coverageType: "PRIVATE",
        createdById: managerUser.id,
      },
    });
    patients.push(patient.id);

    // Fechas de prueba: Lunes 28 de septiembre de 2026
    const testMonday = "2026-09-28";
    const appt1 = await prisma.appointment.create({
      data: {
        professionalId: doc1.id,
        patientId: patient.id,
        serviceId: service.id,
        createdById: managerUser.id,
        startsAt: appointmentInstant(testMonday, 540), // 09:00
        endsAt: appointmentInstant(testMonday, 570), // 09:30
        status: AppointmentStatus.SCHEDULED,
      },
    });
    appointments.push(appt1.id);

    const appt2 = await prisma.appointment.create({
      data: {
        professionalId: doc1.id,
        patientId: patient.id,
        serviceId: service.id,
        createdById: managerUser.id,
        startsAt: appointmentInstant(testMonday, 570), // 09:30
        endsAt: appointmentInstant(testMonday, 600), // 10:00
        status: AppointmentStatus.COMPLETED,
      },
    });
    appointments.push(appt2.id);

    const appt3 = await prisma.appointment.create({
      data: {
        professionalId: doc1.id,
        patientId: patient.id,
        serviceId: service.id,
        createdById: managerUser.id,
        startsAt: appointmentInstant(testMonday, 600), // 10:00
        endsAt: appointmentInstant(testMonday, 630), // 10:30
        status: AppointmentStatus.CANCELLED,
      },
    });
    appointments.push(appt3.id);

    // ── Tests ──

    await verify(
      "Profesional consulta su propia agenda con éxito",
      async () => {
        const agenda = await getProfessionalAgenda(
          { date: testMonday, view: "week" },
          doc1Actor,
        );
        assert.equal(agenda.professional.id, doc1.id);
        assert.equal(agenda.professional.firstName, doc1.firstName);
        assert.equal(agenda.windows.length, 1);
        assert.equal(agenda.windows[0].weekday, Weekday.MONDAY);
        assert.equal(agenda.appointments.length, 3);
      },
    );

    await verify(
      "Profesional es rechazado con FORBIDDEN si intenta consultar agenda ajena",
      async () => {
        await rejects(
          () =>
            getProfessionalAgenda(
              { date: testMonday, professionalId: doc2.id },
              doc1Actor,
            ),
          "FORBIDDEN",
        );
      },
    );

    await verify(
      "Manager puede consultar la agenda de cualquier profesional",
      async () => {
        const agenda = await getProfessionalAgenda(
          { date: testMonday, professionalId: doc1.id },
          managerActor,
        );
        assert.equal(agenda.professional.id, doc1.id);
      },
    );

    await verify(
      "Recepcionista puede consultar la agenda de cualquier profesional",
      async () => {
        const agenda = await getProfessionalAgenda(
          { date: testMonday, professionalId: doc1.id },
          receptionistActor,
        );
        assert.equal(agenda.professional.id, doc1.id);
      },
    );

    await verify(
      "Roles administrativos son rechazados con VALIDATION si no especifican professionalId",
      async () => {
        await rejects(
          () => getProfessionalAgenda({ date: testMonday }, managerActor),
          "VALIDATION",
        );
        await rejects(
          () => getProfessionalAgenda({ date: testMonday }, receptionistActor),
          "VALIDATION",
        );
      },
    );

    await verify(
      "Resumen de KPIs calcula correctamente totales por estado",
      async () => {
        const agenda = await getProfessionalAgenda(
          { date: testMonday, view: "week" },
          doc1Actor,
        );
        assert.deepEqual(agenda.summary, {
          total: 3,
          scheduled: 1,
          completed: 1,
          cancelled: 1,
        });
      },
    );

    await verify(
      "Filtro hideCancelled oculta cancelados de la lista pero mantiene KPI en el resumen",
      async () => {
        const agenda = await getProfessionalAgenda(
          { date: testMonday, view: "week", hideCancelled: true },
          doc1Actor,
        );
        assert.equal(agenda.appointments.length, 2);
        assert.ok(
          agenda.appointments.every(
            (a) => a.status !== AppointmentStatus.CANCELLED,
          ),
        );
        assert.equal(agenda.summary.cancelled, 1);
        assert.equal(agenda.summary.total, 3);
      },
    );

    await verify(
      "Vista diaria retorna solo los turnos del día consultado",
      async () => {
        const agenda = await getProfessionalAgenda(
          { date: testMonday, view: "day" },
          doc1Actor,
        );
        assert.equal(agenda.view, "day");
        assert.equal(agenda.appointments.length, 3);

        // Día siguiente (martes) no tiene turnos
        const tuesdayAgenda = await getProfessionalAgenda(
          { date: "2026-09-29", view: "day" },
          doc1Actor,
        );
        assert.equal(tuesdayAgenda.appointments.length, 0);
        assert.equal(tuesdayAgenda.summary.total, 0);
      },
    );

    console.log(
      `\n${passed} verificaciones de HU-12 ejecutadas correctamente.`,
    );
  } finally {
    if (appointments.length > 0) {
      await prisma.appointment.deleteMany({
        where: { id: { in: appointments } },
      });
    }
    if (professionals.length > 0) {
      await prisma.availabilityWindow.deleteMany({
        where: { professionalId: { in: professionals } },
      });
      await prisma.professional.deleteMany({
        where: { id: { in: professionals } },
      });
    }
    if (patients.length > 0) {
      await prisma.patient.deleteMany({ where: { id: { in: patients } } });
    }
    if (services.length > 0) {
      await prisma.service.deleteMany({ where: { id: { in: services } } });
    }
    if (users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
