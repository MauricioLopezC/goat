// Verificación de HU-18 sobre PostgreSQL local migrado. Crea únicamente
// fixtures identificadas por UUID y elimina sus propios registros al terminar.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { getPatientAppointmentHistory } from "../src/lib/dal/patient-history";
import { DomainError } from "../src/lib/actions";
import {
  AppointmentStatus,
  PaymentStatus,
  Role,
} from "../src/generated/prisma/enums";
import { appointmentInstant } from "../src/lib/appointment-slots";
import { addDays, dateToDb, toLocalSlot } from "../src/lib/schedule";
import type { Actor } from "../src/lib/dal/auth";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Esta verificación solo usa PostgreSQL local.",
  );
  assert.notEqual(process.env.NODE_ENV, "production");
  const tag = `HU18-${randomUUID()}`;
  const users: number[] = [],
    patients: number[] = [],
    professionals: number[] = [],
    services: number[] = [],
    paymentMethods: number[] = [];
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
    const createPatient = async (suffix: string) => {
      const patient = await prisma.patient.create({
        data: {
          firstName: "Paciente",
          lastName: tag,
          gender: "OTHER",
          documentType: "PASSPORT",
          documentNumber: `${tag}-${suffix}`,
          birthDate: dateToDb("2000-01-01"),
          phone: "3875550000",
          email: `${tag}-${suffix}@example.invalid`,
          coverageType: "PRIVATE",
          createdById: manager.id,
        },
      });
      patients.push(patient.id);
      return patient;
    };
    const patient = await createPatient("patient");
    const patientWithoutAppointments = await createPatient("empty");
    const createProfessional = async (suffix: string, userId?: number) => {
      const professional = await prisma.professional.create({
        data: {
          firstName: "Profesional",
          lastName: `${tag}-${suffix}`,
          documentType: "PASSPORT",
          documentNumber: `${tag}-${suffix}`,
          licenseNumber: `${tag}-${suffix}`,
          userId,
          createdById: manager.id,
          services: { connect: { id: service.id } },
        },
      });
      professionals.push(professional.id);
      return professional;
    };
    // El profesional A es el del usuario profesional; B es otro.
    const professionalA = await createProfessional("A", professionalActor.id);
    const professionalB = await createProfessional("B");

    // Turnos en días distintos, lejos de los datos del seed: pasados a más de
    // 500 días y futuros a más de 500 días.
    const today = toLocalSlot(new Date()).date;
    let offset = 0;
    const appointmentWith = async (
      professionalId: number,
      status: AppointmentStatus,
      future = false,
    ) => {
      offset++;
      const date = addDays(today, future ? 500 + offset : -500 - offset);
      return prisma.appointment.create({
        data: {
          patientId: patient.id,
          professionalId,
          serviceId: service.id,
          startsAt: appointmentInstant(date, 600),
          endsAt: appointmentInstant(date, 630),
          status,
          createdById: receptionist.id,
        },
      });
    };
    const withA: { id: number }[] = [];
    for (const status of [
      ...Array<AppointmentStatus>(5).fill(AppointmentStatus.COMPLETED),
      ...Array<AppointmentStatus>(2).fill(AppointmentStatus.EXPIRED),
      ...Array<AppointmentStatus>(2).fill(AppointmentStatus.CANCELLED),
    ])
      withA.push(await appointmentWith(professionalA.id, status));
    for (let i = 0; i < 3; i++)
      withA.push(
        await appointmentWith(
          professionalA.id,
          AppointmentStatus.SCHEDULED,
          true,
        ),
      );
    await appointmentWith(professionalB.id, AppointmentStatus.COMPLETED);
    await appointmentWith(professionalB.id, AppointmentStatus.EXPIRED);
    await appointmentWith(professionalB.id, AppointmentStatus.EXPIRED);

    // Un cancelado con su motivo, y un cobro vigente y otro anulado.
    const [paid, voided] = withA;
    const cancelled = withA[7];
    await prisma.appointmentEvent.create({
      data: {
        appointmentId: cancelled.id,
        type: "CANCELLED",
        reason: `Motivo ${tag}`,
        requestedBy: "el paciente",
        userId: receptionist.id,
      },
    });
    const paymentMethod = await prisma.paymentMethod.create({
      data: { name: `${tag}-efectivo` },
    });
    paymentMethods.push(paymentMethod.id);
    await prisma.payment.create({
      data: {
        appointmentId: paid.id,
        paymentMethodId: paymentMethod.id,
        amount: "1500",
        createdById: receptionist.id,
      },
    });
    await prisma.payment.create({
      data: {
        appointmentId: voided.id,
        paymentMethodId: paymentMethod.id,
        amount: "900",
        status: PaymentStatus.VOIDED,
        createdById: receptionist.id,
        voidedAt: new Date(),
        voidedById: receptionist.id,
        voidReason: tag,
      },
    });

    await verify(
      "mesa de entradas ve todos los turnos, de a 10 y del más reciente al más antiguo",
      async () => {
        const history = await getPatientAppointmentHistory(
          { patientId: patient.id },
          receptionist,
        );
        assert.equal(history.page.total, 15);
        assert.equal(history.page.pageCount, 2);
        assert.equal(history.page.items.length, 10);
        const starts = history.page.items.map((item) => item.startsAt);
        assert.deepEqual(
          starts,
          [...starts].sort((a, b) => b.getTime() - a.getTime()),
        );
        assert.deepEqual(history.attendance, { completed: 6, expired: 4 });
        assert.deepEqual(
          history.professionals.map((professional) => professional.id).sort(),
          [professionalA.id, professionalB.id].sort(),
        );
        const second = await getPatientAppointmentHistory(
          { patientId: patient.id, page: 2 },
          receptionist,
        );
        assert.equal(second.page.items.length, 5);
        // Una página fuera de rango muestra la última.
        const beyond = await getPatientAppointmentHistory(
          { patientId: patient.id, page: 99 },
          manager,
        );
        assert.equal(beyond.page.page, 2);
      },
    );

    await verify(
      "el filtro de estado cambia la lista pero no la asistencia",
      async () => {
        const history = await getPatientAppointmentHistory(
          { patientId: patient.id, status: AppointmentStatus.EXPIRED },
          manager,
        );
        assert.equal(history.page.total, 4);
        assert.ok(
          history.page.items.every(
            (item) => item.status === AppointmentStatus.EXPIRED,
          ),
        );
        assert.deepEqual(history.attendance, { completed: 6, expired: 4 });
      },
    );

    await verify(
      "el filtro de profesional cambia la lista y la asistencia",
      async () => {
        const history = await getPatientAppointmentHistory(
          { patientId: patient.id, professionalId: professionalB.id },
          manager,
        );
        assert.equal(history.page.total, 3);
        assert.deepEqual(history.attendance, { completed: 1, expired: 2 });
      },
    );

    await verify(
      "el profesional ve solo sus turnos con el paciente y no ve el cobro",
      async () => {
        const history = await getPatientAppointmentHistory(
          { patientId: patient.id },
          professionalActor,
        );
        assert.equal(history.page.total, 12);
        assert.ok(
          history.page.items.every(
            (item) => item.professional.id === professionalA.id,
          ),
        );
        assert.deepEqual(history.attendance, { completed: 5, expired: 2 });
        assert.deepEqual(history.professionals, []);
        const all = [
          ...history.page.items,
          ...(
            await getPatientAppointmentHistory(
              { patientId: patient.id, page: 2 },
              professionalActor,
            )
          ).page.items,
        ];
        assert.ok(all.every((item) => item.payment === null));
        const ownFilter = await getPatientAppointmentHistory(
          { patientId: patient.id, professionalId: professionalA.id },
          professionalActor,
        );
        assert.equal(ownFilter.page.total, 12);
      },
    );

    await verify(
      "el profesional no puede pedir los turnos de otro profesional",
      async () => {
        await rejects(
          () =>
            getPatientAppointmentHistory(
              { patientId: patient.id, professionalId: professionalB.id },
              professionalActor,
            ),
          "FORBIDDEN",
        );
      },
    );

    await verify(
      "mesa de entradas ve el cobro vigente y no el anulado",
      async () => {
        const items = [1, 2].map((page) =>
          getPatientAppointmentHistory(
            { patientId: patient.id, page },
            receptionist,
          ),
        );
        const all = (await Promise.all(items)).flatMap(
          (history) => history.page.items,
        );
        const withPaid = all.find((item) => item.id === paid.id);
        assert.equal(withPaid?.payment?.amount, "1500.00");
        assert.equal(withPaid?.payment?.paymentMethod, paymentMethod.name);
        assert.equal(withPaid?.payment?.createdBy.id, receptionist.id);
        assert.equal(all.find((item) => item.id === voided.id)?.payment, null);
      },
    );

    await verify(
      "cada turno trae sus cambios con motivo, autor y quién lo creó",
      async () => {
        const history = await getPatientAppointmentHistory(
          { patientId: patient.id, status: AppointmentStatus.CANCELLED },
          receptionist,
        );
        const item = history.page.items.find(
          (candidate) => candidate.id === cancelled.id,
        );
        assert.ok(item);
        assert.equal(item.createdBy.id, receptionist.id);
        assert.equal(item.events.length, 1);
        assert.equal(item.events[0].type, "CANCELLED");
        assert.equal(item.events[0].reason, `Motivo ${tag}`);
        assert.equal(item.events[0].user.id, receptionist.id);
      },
    );

    await verify(
      "un paciente sin turnos devuelve un historial vacío",
      async () => {
        const history = await getPatientAppointmentHistory(
          { patientId: patientWithoutAppointments.id },
          manager,
        );
        assert.equal(history.page.total, 0);
        assert.deepEqual(history.page.items, []);
        assert.deepEqual(history.attendance, { completed: 0, expired: 0 });
      },
    );

    await verify(
      "paciente inexistente y parámetros inválidos se rechazan",
      async () => {
        await rejects(
          () =>
            getPatientAppointmentHistory({ patientId: 2_000_000_000 }, manager),
          "NOT_FOUND",
        );
        await rejects(
          () => getPatientAppointmentHistory({ patientId: -1 }, manager),
          "VALIDATION",
        );
        await rejects(
          () =>
            getPatientAppointmentHistory(
              { patientId: patient.id },
              { ...manager, role: Role.PATIENT },
            ),
          "FORBIDDEN",
        );
      },
    );

    console.log(
      `${passed} grupos de verificaciones HU-18 PostgreSQL correctos.`,
    );
  } finally {
    await prisma.payment.deleteMany({
      where: { paymentMethodId: { in: paymentMethods } },
    });
    await prisma.appointment.deleteMany({
      where: { createdById: { in: users } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { id: { in: paymentMethods } },
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
