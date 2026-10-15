// Verificación de HU-31 sobre PostgreSQL local migrado: acceso al portal del
// paciente, clave temporal, cambio de contraseña, listado de turnos propios,
// cancelación con anticipación mínima de 24 h y aislamiento de comprobantes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { verify as verifyPassword } from "@node-rs/argon2";
import { prisma } from "../src/lib/prisma";
import { DomainError } from "../src/lib/actions";
import { changePassword, type Actor } from "../src/lib/dal/auth";
import {
  disablePatientAccess,
  enablePatientAccess,
  getPatient,
  updatePatient,
} from "../src/lib/dal/patients";
import {
  cancelAppointment,
  listMyAppointments,
} from "../src/lib/dal/appointments";
import { getPaymentReceipt, registerPayment } from "../src/lib/dal/payments";
import {
  AppointmentEventType,
  AppointmentStatus,
  CoverageType,
  DocumentType,
  Gender,
  Role,
} from "../src/generated/prisma/enums";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Esta verificación solo usa PostgreSQL local.",
  );
  assert.notEqual(process.env.NODE_ENV, "production");

  const tag = `HU31-${randomUUID().slice(0, 8)}`;
  const userIds: number[] = [];
  const patientIds: number[] = [];
  const serviceIds: number[] = [];
  const paymentMethodIds: number[] = [];
  let professionalId = 0;
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
      `Expected DomainError(${code})`,
    );
  }

  try {
    const staffActors: Actor[] = [];
    for (const role of [Role.MANAGER, Role.RECEPTIONIST, Role.PROFESSIONAL]) {
      const u = await prisma.user.create({
        data: {
          email: `${tag.toLowerCase()}-${role.toLowerCase()}@example.invalid`,
          passwordHash: "disabled-login",
          firstName: "Staff",
          lastName: tag,
          role,
        },
      });
      userIds.push(u.id);
      staffActors.push(u);
    }
    const [manager, receptionist, professionalActor] = staffActors;

    const docBase = String(Math.floor(10_000_000 + Math.random() * 80_000_000));

    const prof = await prisma.professional.create({
      data: {
        userId: professionalActor.id,
        firstName: "Roberto",
        lastName: "Trauma",
        documentType: DocumentType.DNI,
        documentNumber: String(Number(docBase) + 99),
        licenseNumber: String(Math.floor(100000 + Math.random() * 800000)),
        createdById: manager.id,
      },
    });
    professionalId = prof.id;

    const service = await prisma.service.create({
      data: {
        name: `${tag}-consulta`,
        durationMinutes: 30,
        price: "18000.00",
      },
    });
    serviceIds.push(service.id);

    const cash = await prisma.paymentMethod.create({
      data: { name: `${tag}-efectivo` },
    });
    paymentMethodIds.push(cash.id);

    const patientA = await prisma.patient.create({
      data: {
        firstName: "Lucía",
        lastName: "PortalA",
        documentType: DocumentType.DNI,
        documentNumber: docBase,
        birthDate: new Date("1992-04-15T00:00:00.000Z"),
        gender: Gender.FEMALE,
        phone: "1155550001",
        email: `${tag.toLowerCase()}-pac-a@example.invalid`,
        coverageType: CoverageType.PRIVATE,
        createdById: receptionist.id,
      },
    });
    const patientB = await prisma.patient.create({
      data: {
        firstName: "Martín",
        lastName: "PortalB",
        documentType: DocumentType.DNI,
        documentNumber: String(Number(docBase) + 1),
        birthDate: new Date("1988-09-20T00:00:00.000Z"),
        gender: Gender.MALE,
        phone: "1155550002",
        email: `${tag.toLowerCase()}-pac-b@example.invalid`,
        coverageType: CoverageType.PRIVATE,
        createdById: receptionist.id,
      },
    });
    patientIds.push(patientA.id, patientB.id);

    let patientActorA!: Actor;

    await verify(
      "habilitar acceso al portal, reutilización de User y permisos",
      async () => {
        await rejects(
          () =>
            enablePatientAccess({ patientId: patientA.id }, professionalActor),
          "FORBIDDEN",
        );

        // Si el paciente está inactivo, rechaza con VALIDATION
        await prisma.patient.update({
          where: { id: patientA.id },
          data: { active: false },
        });
        await rejects(
          () => enablePatientAccess({ patientId: patientA.id }, receptionist),
          "VALIDATION",
        );
        await prisma.patient.update({
          where: { id: patientA.id },
          data: { active: true },
        });

        const firstEnable = await enablePatientAccess(
          { patientId: patientA.id },
          receptionist,
        );
        userIds.push(firstEnable.userId);
        assert.equal(firstEnable.email, patientA.email);
        assert.equal(firstEnable.temporaryPassword.length, 10);

        const createdUser = await prisma.user.findUniqueOrThrow({
          where: { id: firstEnable.userId },
        });
        assert.equal(createdUser.role, Role.PATIENT);
        assert.equal(createdUser.active, true);
        assert.equal(createdUser.mustChangePassword, true);
        assert.ok(
          await verifyPassword(
            createdUser.passwordHash,
            firstEnable.temporaryPassword,
          ),
        );

        // Regenerar clave reutiliza el mismo User
        const secondEnable = await enablePatientAccess(
          { patientId: patientA.id },
          manager,
        );
        assert.equal(secondEnable.userId, firstEnable.userId);
        assert.notEqual(
          secondEnable.temporaryPassword,
          firstEnable.temporaryPassword,
        );

        patientActorA = {
          id: secondEnable.userId,
          email: secondEnable.email,
          firstName: patientA.firstName,
          lastName: patientA.lastName,
          role: Role.PATIENT,
          mustChangePassword: true,
        };

        // Cambiar contraseña en el primer ingreso
        await rejects(
          () =>
            changePassword(
              {
                currentPassword: "wrong-password",
                newPassword: "NuevaPassword123",
                confirmPassword: "NuevaPassword123",
              },
              patientActorA,
            ),
          "INVALID_CREDENTIALS",
        );

        await rejects(
          () =>
            changePassword(
              {
                currentPassword: secondEnable.temporaryPassword,
                newPassword: secondEnable.temporaryPassword,
                confirmPassword: secondEnable.temporaryPassword,
              },
              patientActorA,
            ),
          "VALIDATION",
        );

        await changePassword(
          {
            currentPassword: secondEnable.temporaryPassword,
            newPassword: "NuevaPassword123",
            confirmPassword: "NuevaPassword123",
          },
          patientActorA,
        );

        const updatedUser = await prisma.user.findUniqueOrThrow({
          where: { id: secondEnable.userId },
        });
        assert.equal(updatedUser.mustChangePassword, false);
        assert.ok(
          await verifyPassword(updatedUser.passwordHash, "NuevaPassword123"),
        );
        patientActorA.mustChangePassword = false;
      },
    );

    await verify(
      "sincronizar User al editar paciente y deshabilitar/reactivar acceso",
      async () => {
        const newEmail = `${tag.toLowerCase()}-pac-a-updated@example.invalid`;
        await updatePatient(
          {
            id: patientA.id,
            firstName: "Lucía María",
            lastName: "PortalA",
            documentType: DocumentType.DNI,
            documentNumber: docBase,
            birthDate: "1992-04-15",
            gender: Gender.FEMALE,
            phone: "1155559999",
            email: newEmail,
            coverageType: CoverageType.PRIVATE,
            guardianName: undefined,
            guardianPhone: undefined,
            memberNumber: undefined,
            address: undefined,
            city: undefined,
            emergencyContactName: undefined,
            emergencyContactPhone: undefined,
            emergencyContactRelationship: undefined,
            notes: undefined,
          },
          receptionist,
        );

        const syncedUser = await prisma.user.findUniqueOrThrow({
          where: { id: patientActorA.id },
        });
        assert.equal(syncedUser.email, newEmail);
        assert.equal(syncedUser.firstName, "Lucía María");
        assert.equal(syncedUser.phone, "1155559999");

        // Deshabilitar acceso
        await rejects(
          () =>
            disablePatientAccess({ patientId: patientA.id }, professionalActor),
          "FORBIDDEN",
        );
        await disablePatientAccess({ patientId: patientA.id }, receptionist);

        const afterDisable = await getPatient(patientA.id, receptionist);
        assert.equal(afterDisable.active, true);
        assert.equal(afterDisable.user?.active, false);

        // Reactivar acceso
        const reenabled = await enablePatientAccess(
          { patientId: patientA.id },
          receptionist,
        );
        assert.equal(reenabled.userId, patientActorA.id);
        const afterReenable = await getPatient(patientA.id, receptionist);
        assert.equal(afterReenable.user?.active, true);
        assert.equal(afterReenable.user?.mustChangePassword, true);
      },
    );

    await verify(
      "listMyAppointments, regla de 24 h para cancelar y aislamiento entre pacientes",
      async () => {
        const now = new Date("2026-07-10T12:00:00.000Z");
        const in48h = new Date(now.getTime() + 48 * 3600_000);
        const in12h = new Date(now.getTime() + 12 * 3600_000);
        const past24h = new Date(now.getTime() - 24 * 3600_000);

        const apptCancelable = await prisma.appointment.create({
          data: {
            patientId: patientA.id,
            professionalId,
            serviceId: service.id,
            startsAt: in48h,
            endsAt: new Date(in48h.getTime() + 30 * 60_000),
            status: AppointmentStatus.SCHEDULED,
            notes: "Nota interna confidencial",
            createdById: receptionist.id,
          },
        });

        const apptWithin24h = await prisma.appointment.create({
          data: {
            patientId: patientA.id,
            professionalId,
            serviceId: service.id,
            startsAt: in12h,
            endsAt: new Date(in12h.getTime() + 30 * 60_000),
            status: AppointmentStatus.SCHEDULED,
            createdById: receptionist.id,
          },
        });

        const apptCompleted = await prisma.appointment.create({
          data: {
            patientId: patientA.id,
            professionalId,
            serviceId: service.id,
            startsAt: past24h,
            endsAt: new Date(past24h.getTime() + 30 * 60_000),
            status: AppointmentStatus.COMPLETED,
            createdById: receptionist.id,
          },
        });

        const apptOtherPatient = await prisma.appointment.create({
          data: {
            patientId: patientB.id,
            professionalId,
            serviceId: service.id,
            startsAt: new Date(in48h.getTime() + 3600_000),
            endsAt: new Date(in48h.getTime() + 5400_000),
            status: AppointmentStatus.SCHEDULED,
            createdById: receptionist.id,
          },
        });

        await rejects(() => listMyAppointments(receptionist, now), "FORBIDDEN");

        const myAppts = await listMyAppointments(patientActorA, now);
        assert.equal(myAppts.upcoming.length, 2);
        // Del más cercano (in12h) al más lejano (in48h)
        assert.equal(myAppts.upcoming[0].id, apptWithin24h.id);
        assert.equal(myAppts.upcoming[0].canCancel, false);
        assert.equal(myAppts.upcoming[0].withinNoticeWindow, false);

        assert.equal(myAppts.upcoming[1].id, apptCancelable.id);
        assert.equal(myAppts.upcoming[1].canCancel, true);
        assert.equal(myAppts.upcoming[1].withinNoticeWindow, true);
        assert.equal("notes" in myAppts.upcoming[1], false);

        assert.equal(myAppts.past.length, 1);
        assert.equal(myAppts.past[0].id, apptCompleted.id);

        // No puede cancelar un turno con menos de 24h de anticipación
        await rejects(
          () =>
            cancelAppointment(
              {
                appointmentId: apptWithin24h.id,
                reason: "Intento sobre la hora",
              },
              patientActorA,
              now,
            ),
          "CANCELLATION_WINDOW_EXPIRED",
        );

        // No puede cancelar el turno de otro paciente
        await rejects(
          () =>
            cancelAppointment(
              {
                appointmentId: apptOtherPatient.id,
                reason: "Intento turno ajeno",
              },
              patientActorA,
              now,
            ),
          "FORBIDDEN",
        );

        // Cancela su propio turno con >= 24h de anticipación
        await cancelAppointment(
          {
            appointmentId: apptCancelable.id,
            reason: "Viaje imprevisto",
          },
          patientActorA,
          now,
        );

        const cancelledInDb = await prisma.appointment.findUniqueOrThrow({
          where: { id: apptCancelable.id },
          include: { events: true },
        });
        assert.equal(cancelledInDb.status, AppointmentStatus.CANCELLED);
        assert.equal(cancelledInDb.events.length, 1);
        assert.equal(
          cancelledInDb.events[0].type,
          AppointmentEventType.CANCELLED,
        );
        assert.equal(cancelledInDb.events[0].userId, patientActorA.id);
        assert.equal(cancelledInDb.events[0].requestedBy, "El paciente");
        assert.equal(cancelledInDb.events[0].reason, "Viaje imprevisto");

        // Comprobante de pago propio vs ajeno
        const ownPayment = await registerPayment(
          {
            appointmentId: apptCompleted.id,
            paymentMethodId: cash.id,
          },
          receptionist,
        );
        const otherPayment = await registerPayment(
          {
            appointmentId: apptOtherPatient.id,
            paymentMethodId: cash.id,
          },
          receptionist,
        );

        const receipt = await getPaymentReceipt(ownPayment.id, patientActorA);
        assert.equal(receipt.paymentId, ownPayment.id);

        await rejects(
          () => getPaymentReceipt(otherPayment.id, patientActorA),
          "FORBIDDEN",
        );
      },
    );

    console.log(`\nHU-31 verificado: ${passed} bloques OK.`);
  } finally {
    if (patientIds.length > 0 || professionalId > 0) {
      await prisma.payment.deleteMany({
        where: { appointment: { patientId: { in: patientIds } } },
      });
      await prisma.appointmentEvent.deleteMany({
        where: { appointment: { patientId: { in: patientIds } } },
      });
      await prisma.appointment.deleteMany({
        where: { patientId: { in: patientIds } },
      });
    }
    if (patientIds.length > 0) {
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    }
    if (professionalId > 0) {
      await prisma.professional.deleteMany({ where: { id: professionalId } });
    }
    if (serviceIds.length > 0) {
      await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    }
    if (paymentMethodIds.length > 0) {
      await prisma.paymentMethod.deleteMany({
        where: { id: { in: paymentMethodIds } },
      });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
