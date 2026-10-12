// Verificación de HU-21 sobre PostgreSQL local migrado: cobro, anulación,
// autorización, concurrencia y permisos. Crea sus propios datos y los borra.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { DomainError } from "../src/lib/actions";
import {
  getAppointmentBilling,
  getPaymentReceipt,
  getPaymentStates,
  listTodayAppointments,
  registerAuthorization,
  registerPayment,
  voidPayment,
} from "../src/lib/dal/payments";
import {
  cancelAppointment,
  cancelProfessionalAppointment,
  completeAppointment,
  expireAppointment,
  getAttendanceCertificate,
} from "../src/lib/dal/appointments";
import { appointmentInstant } from "../src/lib/appointment-slots";
import { addDays, dateToDb, toLocalSlot } from "../src/lib/schedule";
import { Role, type CoverageType } from "../src/generated/prisma/enums";
import type { Actor } from "../src/lib/dal/auth";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Esta verificación solo usa PostgreSQL local.",
  );
  assert.notEqual(process.env.NODE_ENV, "production");
  const tag = `HU21-${randomUUID()}`;
  const users: number[] = [],
    patients: number[] = [],
    services: number[] = [],
    paymentMethods: number[] = [];
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

    const priced = await prisma.service.create({
      data: { name: `${tag}-valor`, durationMinutes: 30, price: "15000.00" },
    });
    const unpriced = await prisma.service.create({
      data: { name: `${tag}-sin-valor`, durationMinutes: 30 },
    });
    const referral = await prisma.service.create({
      data: {
        name: `${tag}-orden`,
        durationMinutes: 30,
        price: "20000.00",
        requiresReferral: true,
      },
    });
    services.push(priced.id, unpriced.id, referral.id);

    const cash = await prisma.paymentMethod.create({
      data: { name: `${tag}-efectivo` },
    });
    const inactive = await prisma.paymentMethod.create({
      data: { name: `${tag}-inactivo`, active: false },
    });
    paymentMethods.push(cash.id, inactive.id);

    const professional = await prisma.professional.create({
      data: {
        firstName: "Profesional",
        lastName: tag,
        documentType: "PASSPORT",
        documentNumber: `${tag}-professional`,
        licenseNumber: tag,
        createdById: manager.id,
        userId: professionalActor.id,
        services: { connect: services.map((id) => ({ id })) },
      },
    });
    professionalId = professional.id;

    const plan = await prisma.insurancePlan.findFirst({ select: { id: true } });
    async function createPatient(coverageType: CoverageType) {
      const patient = await prisma.patient.create({
        data: {
          firstName: "Paciente",
          lastName: `${tag}-${patients.length}`,
          gender: "OTHER",
          documentType: "PASSPORT",
          documentNumber: `${tag}-patient-${patients.length}`,
          birthDate: dateToDb("2000-01-01"),
          phone: "0000000000",
          email: `${tag}-${patients.length}@example.invalid`,
          coverageType,
          createdById: manager.id,
          ...(coverageType === "HEALTH_INSURANCE" && plan
            ? {
                coverage: {
                  create: { insurancePlanId: plan.id, memberNumber: tag },
                },
              }
            : {}),
        },
      });
      patients.push(patient.id);
      return patient.id;
    }
    const privatePatient = await createPatient("PRIVATE");
    const insuredPatient = await createPatient("HEALTH_INSURANCE");

    // Cada turno en un horario propio del profesional de prueba: la
    // restricción de exclusión no deja superponerlos.
    const today = toLocalSlot(new Date()).date;
    let nextMinute = 0;
    async function appointment(input: {
      patientId?: number;
      serviceId?: number;
      date?: string;
      status?: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
    }) {
      const minute = nextMinute;
      nextMinute += 30;
      const date = input.date ?? today;
      const created = await prisma.appointment.create({
        data: {
          patientId: input.patientId ?? privatePatient,
          professionalId,
          serviceId: input.serviceId ?? priced.id,
          startsAt: appointmentInstant(date, minute),
          endsAt: appointmentInstant(date, minute + 30),
          status: input.status ?? "SCHEDULED",
          createdById: manager.id,
        },
      });
      return created.id;
    }

    await verify(
      "cobra con el monto del servicio y lo conserva si cambia el valor",
      async () => {
        const id = await appointment({});
        const paid = await registerPayment(
          { appointmentId: id, paymentMethodId: cash.id },
          receptionist,
        );
        assert.equal(paid.amount, "15000.00");
        await prisma.service.update({
          where: { id: priced.id },
          data: { price: "18000.00" },
        });
        const billing = await getAppointmentBilling(id, manager);
        assert.equal(billing.state, "PAID");
        assert.equal(billing.activePayment?.amount, "15000.00");
        assert.equal(billing.activePayment?.createdBy.id, receptionist.id);
        await prisma.service.update({
          where: { id: priced.id },
          data: { price: "15000.00" },
        });
      },
    );

    await verify("no cobra dos veces el mismo turno", async () => {
      const id = await appointment({});
      await registerPayment(
        { appointmentId: id, paymentMethodId: cash.id },
        receptionist,
      );
      await rejects(
        () =>
          registerPayment(
            { appointmentId: id, paymentMethodId: cash.id },
            manager,
          ),
        "APPOINTMENT_ALREADY_PAID",
      );
    });

    await verify(
      "dos cobros simultáneos: gana uno y el otro ve el turno cobrado",
      async () => {
        const id = await appointment({});
        const results = await Promise.allSettled(
          [receptionist, manager].map((actor) =>
            registerPayment(
              { appointmentId: id, paymentMethodId: cash.id },
              actor,
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const failed = results.find((r) => r.status === "rejected");
        assert.ok(
          failed?.status === "rejected" &&
            failed.reason instanceof DomainError &&
            failed.reason.code === "APPOINTMENT_ALREADY_PAID",
        );
        assert.equal(
          await prisma.payment.count({
            where: { appointmentId: id, status: "PAID" },
          }),
          1,
        );
      },
    );

    await verify(
      "rechaza obra social, servicio sin valor y medio inactivo",
      async () => {
        await rejects(
          async () =>
            registerPayment(
              {
                appointmentId: await appointment({
                  patientId: insuredPatient,
                }),
                paymentMethodId: cash.id,
              },
              receptionist,
            ),
          "PATIENT_HAS_HEALTH_INSURANCE",
        );
        await rejects(
          async () =>
            registerPayment(
              {
                appointmentId: await appointment({ serviceId: unpriced.id }),
                paymentMethodId: cash.id,
              },
              receptionist,
            ),
          "SERVICE_WITHOUT_PRICE",
        );
        await rejects(
          async () =>
            registerPayment(
              {
                appointmentId: await appointment({}),
                paymentMethodId: inactive.id,
              },
              receptionist,
            ),
          "VALIDATION",
        );
      },
    );

    await verify(
      "solo cobra turnos Programados de hoy o Completados",
      async () => {
        const tomorrow = await appointment({ date: addDays(today, 1) });
        await rejects(
          () =>
            registerPayment(
              { appointmentId: tomorrow, paymentMethodId: cash.id },
              receptionist,
            ),
          "INVALID_STATUS_TRANSITION",
        );
        const cancelled = await appointment({ status: "CANCELLED" });
        await rejects(
          () =>
            registerPayment(
              { appointmentId: cancelled, paymentMethodId: cash.id },
              receptionist,
            ),
          "INVALID_STATUS_TRANSITION",
        );
        const completed = await appointment({
          date: addDays(today, -3),
          status: "COMPLETED",
        });
        await registerPayment(
          { appointmentId: completed, paymentMethodId: cash.id },
          receptionist,
        );
      },
    );

    await verify(
      "anular exige motivo, deja traza y permite volver a cobrar",
      async () => {
        const id = await appointment({});
        const paid = await registerPayment(
          { appointmentId: id, paymentMethodId: cash.id },
          receptionist,
        );
        await rejects(
          () => voidPayment({ paymentId: paid.id, reason: "   " }, manager),
          "REASON_REQUIRED",
        );
        await voidPayment(
          { paymentId: paid.id, reason: "Medio equivocado" },
          manager,
        );
        await rejects(
          () =>
            voidPayment({ paymentId: paid.id, reason: "Otra vez" }, manager),
          "INVALID_STATUS_TRANSITION",
        );
        const voided = await prisma.payment.findUniqueOrThrow({
          where: { id: paid.id },
        });
        assert.equal(voided.status, "VOIDED");
        assert.equal(voided.voidedById, manager.id);
        assert.equal(voided.voidReason, "Medio equivocado");
        await registerPayment(
          { appointmentId: id, paymentMethodId: cash.id },
          receptionist,
        );
        const billing = await getAppointmentBilling(id, manager);
        assert.equal(billing.state, "PAID");
        assert.equal(billing.voidedPayments.length, 1);
      },
    );

    await verify(
      "con cobro vigente no se cancela ni se vence, pero sí se completa",
      async () => {
        const id = await appointment({ date: addDays(today, -1) });
        // Programado de ayer: no se cobra, pero se fuerza el cobro vigente
        // para probar la guarda de vencer.
        await prisma.payment.create({
          data: {
            appointmentId: id,
            paymentMethodId: cash.id,
            amount: "15000.00",
            createdById: receptionist.id,
          },
        });
        await rejects(
          () =>
            cancelAppointment(
              { appointmentId: id, reason: "x", requestedBy: "paciente" },
              receptionist,
            ),
          "APPOINTMENT_HAS_PAYMENT",
        );
        await rejects(
          () =>
            cancelProfessionalAppointment(
              {
                appointmentId: id,
                professionalId,
                reason: "x",
                requestedBy: "centro",
              },
              manager,
            ),
          // Ya comenzó: la regla de estado corta antes que la del cobro.
          "INVALID_STATUS_TRANSITION",
        );
        await rejects(
          () => expireAppointment({ appointmentId: id }, receptionist),
          "APPOINTMENT_HAS_PAYMENT",
        );
        await completeAppointment({ appointmentId: id }, receptionist);
      },
    );

    await verify(
      "cobrar y cancelar a la vez: no queda un turno cancelado y cobrado",
      async () => {
        for (let i = 0; i < 5; i++) {
          const id = await appointment({});
          await Promise.allSettled([
            registerPayment(
              { appointmentId: id, paymentMethodId: cash.id },
              receptionist,
            ),
            cancelAppointment(
              { appointmentId: id, reason: "x", requestedBy: "paciente" },
              manager,
            ),
          ]);
          const row = await prisma.appointment.findUniqueOrThrow({
            where: { id },
            select: {
              status: true,
              payments: { where: { status: "PAID" }, select: { id: true } },
            },
          });
          assert.ok(
            !(row.status === "CANCELLED" && row.payments.length > 0),
            "Un turno cancelado no puede tener cobro vigente",
          );
          assert.ok(row.status === "CANCELLED" || row.payments.length === 1);
        }
      },
    );

    await verify(
      "autorización: solo con obra social y orden; corregirla deja historial",
      async () => {
        await rejects(
          async () =>
            registerAuthorization(
              {
                appointmentId: await appointment({ serviceId: referral.id }),
                authorizationNumber: "A-1",
              },
              receptionist,
            ),
          "AUTHORIZATION_NOT_REQUIRED",
        );
        await rejects(
          async () =>
            registerAuthorization(
              {
                appointmentId: await appointment({
                  patientId: insuredPatient,
                }),
                authorizationNumber: "A-1",
              },
              receptionist,
            ),
          "AUTHORIZATION_NOT_REQUIRED",
        );
        const id = await appointment({
          patientId: insuredPatient,
          serviceId: referral.id,
        });
        assert.equal(
          (await getAppointmentBilling(id, manager)).state,
          "PENDING_AUTHORIZATION",
        );
        await registerAuthorization(
          { appointmentId: id, authorizationNumber: "A-1" },
          receptionist,
        );
        await registerAuthorization(
          { appointmentId: id, authorizationNumber: "A-2" },
          manager,
        );
        const billing = await getAppointmentBilling(id, manager);
        assert.equal(billing.state, "AUTHORIZED");
        assert.equal(billing.authorization?.number, "A-2");
        assert.equal(billing.authorization?.by?.id, manager.id);
        const events = await prisma.appointmentEvent.findMany({
          where: { appointmentId: id },
        });
        assert.equal(events.length, 1);
        assert.equal(events[0].type, "UPDATED");
        assert.ok(events[0].reason?.includes("A-1"));
      },
    );

    await verify(
      "marca del calendario solo en turnos de hoy y completados",
      async () => {
        const todayId = await appointment({});
        const tomorrowId = await appointment({ date: addDays(today, 1) });
        const insuredNoReferral = await appointment({
          patientId: insuredPatient,
        });
        const states = await getPaymentStates(
          [todayId, tomorrowId, insuredNoReferral],
          receptionist,
        );
        assert.deepEqual(states, { [todayId]: "PENDING_PAYMENT" });
      },
    );

    await verify(
      "turnos de hoy: todos los de hoy, con el estado de cobro si aplica",
      async () => {
        const pendingId = await appointment({});
        const paidId = await appointment({});
        await registerPayment(
          { appointmentId: paidId, paymentMethodId: cash.id },
          receptionist,
        );
        const tomorrowId = await appointment({ date: addDays(today, 1) });
        const insuredNoReferral = await appointment({
          patientId: insuredPatient,
        });
        const rows = await listTodayAppointments(receptionist);
        const byId = new Map(rows.map((row) => [row.id, row]));
        assert.equal(byId.get(pendingId)?.state, "PENDING_PAYMENT");
        assert.equal(byId.get(pendingId)?.price, "15000.00");
        assert.equal(byId.get(paidId)?.state, "PAID");
        assert.equal(byId.get(paidId)?.activePayment?.amount, "15000.00");
        assert.equal(byId.has(tomorrowId), false);
        assert.equal(byId.get(insuredNoReferral)?.state, null);
      },
    );

    await verify("el profesional no cobra, no anula ni ve cobros", async () => {
      const id = await appointment({});
      await rejects(
        () =>
          registerPayment(
            { appointmentId: id, paymentMethodId: cash.id },
            professionalActor,
          ),
        "FORBIDDEN",
      );
      await rejects(
        () => voidPayment({ paymentId: 1, reason: "x" }, professionalActor),
        "FORBIDDEN",
      );
      await rejects(
        () =>
          registerAuthorization(
            { appointmentId: id, authorizationNumber: "A" },
            professionalActor,
          ),
        "FORBIDDEN",
      );
      await rejects(
        () => getAppointmentBilling(id, professionalActor),
        "FORBIDDEN",
      );
      await rejects(
        () => getPaymentStates([id], professionalActor),
        "FORBIDDEN",
      );
      await rejects(
        () => listTodayAppointments(professionalActor),
        "FORBIDDEN",
      );
      await rejects(
        () => getPaymentReceipt(id, professionalActor),
        "FORBIDDEN",
      );
    });

    // 13. Comprobante de cobro (HU-24)
    await verify(
      "comprobante: activo, anulado, correlativo y permisos (HU-24)",
      async () => {
        const id = await appointment({});
        const paid = await registerPayment(
          { appointmentId: id, paymentMethodId: cash.id },
          receptionist,
        );
        assert.ok(
          paid.receiptNumber > 0,
          "Debe tener receiptNumber correlativo",
        );
        assert.equal(paid.amount, "15000.00");

        // Recepcionista y Gerente pueden consultarlo
        const receipt = await getPaymentReceipt(paid.id, receptionist);
        assert.equal(receipt.receiptNumber, paid.receiptNumber);
        assert.equal(receipt.paymentId, paid.id);
        assert.equal(receipt.status, "PAID");
        assert.equal(receipt.amount, "15000.00");
        assert.equal(receipt.paymentMethod, `${tag}-efectivo`);
        assert.equal(
          receipt.center.legend,
          "Comprobante no válido como factura",
        );
        assert.equal(receipt.voidedAt, null);
        assert.ok(receipt.patient.lastName.length > 0);
        assert.ok(receipt.appointment.service.name.length > 0);

        const mgrReceipt = await getPaymentReceipt(paid.id, manager);
        assert.equal(mgrReceipt.receiptNumber, paid.receiptNumber);

        // Profesional no tiene acceso
        await rejects(
          () => getPaymentReceipt(paid.id, professionalActor),
          "FORBIDDEN",
        );

        // Cobro inexistente da NOT_FOUND
        await rejects(
          () => getPaymentReceipt(99999999, receptionist),
          "NOT_FOUND",
        );

        // ID no válido da VALIDATION
        await rejects(() => getPaymentReceipt(-1, receptionist), "VALIDATION");

        // Anular el cobro
        await voidPayment(
          { paymentId: paid.id, reason: "Error de carga para prueba" },
          manager,
        );

        // El comprobante anulado conserva el número y trae datos de anulación
        const voidedReceipt = await getPaymentReceipt(paid.id, receptionist);
        assert.equal(voidedReceipt.status, "VOIDED");
        assert.equal(voidedReceipt.receiptNumber, paid.receiptNumber);
        assert.equal(voidedReceipt.voidReason, "Error de carga para prueba");
        assert.ok(voidedReceipt.voidedAt !== null);
        assert.equal(voidedReceipt.voidedBy?.id, manager.id);
      },
    );

    await verify(
      "constancia de atención: emite con datos del centro y paciente, rechaza cancelados y profesionales",
      async () => {
        const apptId = await appointment({
          patientId: insuredPatient,
          serviceId: referral.id,
        });

        const cert = await getAttendanceCertificate(apptId, receptionist);
        assert.equal(cert.appointmentId, apptId);
        assert.equal(cert.patient.id, insuredPatient);
        assert.ok(cert.patient.lastName.length > 0);
        assert.ok(cert.service.name.length > 0);
        assert.ok(cert.professional.lastName.length > 0);
        assert.equal(cert.center.name, "GOAT Policonsultorio");

        // Manager también puede emitir
        const certMgr = await getAttendanceCertificate(apptId, manager);
        assert.equal(certMgr.appointmentId, apptId);

        // Profesional no tiene permiso
        await rejects(
          () => getAttendanceCertificate(apptId, professionalActor),
          "FORBIDDEN",
        );

        // Inexistente da NOT_FOUND
        await rejects(
          () => getAttendanceCertificate(99999999, receptionist),
          "NOT_FOUND",
        );

        // Cancelar el turno
        await cancelAppointment(
          {
            appointmentId: apptId,
            reason: "Cancelado de prueba",
            requestedBy: "PACIENTE",
          },
          receptionist,
        );

        // Turno cancelado rechaza con VALIDATION
        await rejects(
          () => getAttendanceCertificate(apptId, receptionist),
          "VALIDATION",
        );
      },
    );

    console.log(`\n${passed} verificaciones de HU-21 y HU-24 pasaron.`);
  } finally {
    const appointments = await prisma.appointment.findMany({
      where: { createdById: { in: users } },
      select: { id: true },
    });
    const appointmentIds = appointments.map((a) => a.id);
    await prisma.payment.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: appointmentIds } },
    });
    if (professionalId)
      await prisma.professional.delete({ where: { id: professionalId } });
    await prisma.patient.deleteMany({ where: { id: { in: patients } } });
    await prisma.service.deleteMany({ where: { id: { in: services } } });
    await prisma.paymentMethod.deleteMany({
      where: { id: { in: paymentMethods } },
    });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
