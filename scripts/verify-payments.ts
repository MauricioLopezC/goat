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
  closeCash,
  getCashSummary,
  listCashClosings,
  getUnclosedCashDays,
} from "../src/lib/dal/cash";
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
      data: { name: `${tag}-efectivo`, isCash: true },
    });
    const inactive = await prisma.paymentMethod.create({
      data: { name: `${tag}-inactivo`, active: false },
    });
    const debit = await prisma.paymentMethod.create({
      data: { name: `${tag}-debito`, isCash: false },
    });
    paymentMethods.push(cash.id, inactive.id, debit.id);

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

    await verify(
      "HU-27: Arqueo, cierre de caja, restricciones y ajustes posteriores de gerencia",
      async () => {
        // Buscar dos fechas pasadas consecutivas que no tengan ni cierres ni cobros existentes
        let candidateDaysAgo = 60;
        let testDate = "";
        let testDate2 = "";
        while (candidateDaysAgo < 1000) {
          const d1 = new Date();
          d1.setDate(d1.getDate() - candidateDaysAgo);
          const s1 = toLocalSlot(d1).date;

          const d2 = new Date();
          d2.setDate(d2.getDate() - candidateDaysAgo + 1);
          const s2 = toLocalSlot(d2).date;

          const closings = await prisma.cashClosing.count({
            where: { date: { in: [dateToDb(s1), dateToDb(s2)] } },
          });
          const payments = await prisma.payment.count({
            where: {
              createdAt: {
                gte: appointmentInstant(s1, 0),
                lt: appointmentInstant(s2, 1440),
              },
            },
          });
          if (closings === 0 && payments === 0) {
            testDate = s1;
            testDate2 = s2;
            break;
          }
          candidateDaysAgo++;
        }
        assert.ok(
          testDate && testDate2,
          "Se deben encontrar dos fechas de prueba consecutivas sin datos",
        );

        // Crear turnos completados en esa fecha
        const appt1 = await appointment({
          status: "COMPLETED",
          date: testDate,
        });
        const appt2 = await appointment({
          status: "COMPLETED",
          date: testDate,
        });
        const apptDebit = await appointment({
          status: "COMPLETED",
          date: testDate,
        });
        const apptH4 = await appointment({
          status: "COMPLETED",
          date: testDate,
        });

        const payDate1 = new Date(appointmentInstant(testDate, 600));
        const payDate2 = new Date(appointmentInstant(testDate, 660));

        // Cobrar turnos con fechas en testDate
        const pay1 = await registerPayment(
          {
            appointmentId: appt1,
            paymentMethodId: cash.id,
            now: payDate1,
          },
          receptionist,
        );
        const pay2 = await registerPayment(
          {
            appointmentId: appt2,
            paymentMethodId: cash.id,
            now: payDate2,
          },
          receptionist,
        );
        const payDebit = await registerPayment(
          {
            appointmentId: apptDebit,
            paymentMethodId: debit.id,
            now: payDate1,
          },
          receptionist,
        );
        const payH4 = await registerPayment(
          {
            appointmentId: apptH4,
            paymentMethodId: cash.id,
            now: payDate1,
          },
          receptionist,
        );

        // H4: Anular payH4 en testDate2 (día siguiente).
        // Debe aparecer en los cobros anulados del día 2 (por voidedAt), NO en el día 1.
        const voidDate2 = new Date(appointmentInstant(testDate2, 600));
        await voidPayment(
          {
            paymentId: payH4.id,
            reason: "Anulado al día siguiente",
            now: voidDate2,
          },
          receptionist,
        );

        const summaryDay1 = await getCashSummary(testDate, receptionist);
        assert.ok(!summaryDay1.voidedPayments.some((p) => p.id === payH4.id));

        const summaryDay2 = await getCashSummary(testDate2, receptionist);
        assert.ok(summaryDay2.voidedPayments.some((p) => p.id === payH4.id));

        // getCashSummary muestra cobros activos en vivo (efectivo suma, débito no suma a expectedCash)
        const summaryOpen = await getCashSummary(testDate, receptionist);
        assert.equal(summaryOpen.isClosed, false);
        assert.equal(summaryOpen.summary.paymentCount, 3);
        assert.equal(summaryOpen.summary.totalAmount, "45000.00");
        assert.equal(summaryOpen.summary.expectedCashAmount, "30000.00");

        // getUnclosedCashDays detecta que testDate tiene cobros sin cerrar
        const unclosed = await getUnclosedCashDays(receptionist);
        assert.ok(unclosed.includes(testDate));

        // Intento de cerrar con fecha futura falla
        await rejects(
          () =>
            closeCash(
              { date: "2099-01-01", countedCashAmount: 30000 },
              receptionist,
            ),
          "VALIDATION",
        );

        // Intento de cerrar con diferencia sin notas falla
        await rejects(
          () =>
            closeCash(
              { date: testDate, countedCashAmount: 25000, notes: "" },
              receptionist,
            ),
          "VALIDATION",
        );

        // Cierre con diferencia y observaciones obligatorias pasa
        const closingResult = await closeCash(
          {
            date: testDate,
            countedCashAmount: 28000,
            notes: "Faltante de $2000 por cambio",
          },
          receptionist,
        );
        assert.equal(closingResult.date, testDate);

        // Reintentar cerrar el mismo día falla con DUPLICATE
        await rejects(
          () =>
            closeCash(
              { date: testDate, countedCashAmount: 28000, notes: "reintento" },
              receptionist,
            ),
          "DUPLICATE",
        );

        // Verificar que los pagos quedaron vinculados a la caja
        const linkedPayments = await prisma.payment.findMany({
          where: { id: { in: [pay1.id, pay2.id, payDebit.id] } },
          select: { cashClosingId: true },
        });
        assert.equal(linkedPayments[0].cashClosingId, closingResult.id);
        assert.equal(linkedPayments[1].cashClosingId, closingResult.id);
        assert.equal(linkedPayments[2].cashClosingId, closingResult.id);

        // Una vez cerrada, testDate ya no aparece en getUnclosedCashDays
        const unclosedAfter = await getUnclosedCashDays(receptionist);
        assert.ok(!unclosedAfter.includes(testDate));

        // H1: Intento de registrar cobro en día con caja cerrada rechaza con CASH_CLOSED
        const apptClosedDay = await appointment({
          status: "COMPLETED",
          date: testDate,
        });
        await rejects(
          () =>
            registerPayment(
              {
                appointmentId: apptClosedDay,
                paymentMethodId: cash.id,
                now: payDate1,
              },
              receptionist,
            ),
          "CASH_CLOSED",
        );

        // H2: La recepcionista no puede anular cobros de una caja cerrada
        await rejects(
          () =>
            voidPayment(
              { paymentId: pay1.id, reason: "Error de cobro" },
              receptionist,
            ),
          "FORBIDDEN",
        );

        // H5: Renombrar el medio de pago en efectivo a "Contado" y verificar que la anulación
        // de gerencia conserve la clasificación de efectivo en correctedCashAmount.
        await prisma.paymentMethod.update({
          where: { id: cash.id },
          data: { name: `${tag}-contado` },
        });

        // El gerente SÍ puede anular un cobro de una caja cerrada (corrección)
        await voidPayment(
          { paymentId: pay1.id, reason: "Corrección autorizada por gerencia" },
          manager,
        );

        // R1: Verificar que voidedAt de la anulación es posterior a closedAt
        const pay1Row = await prisma.payment.findUniqueOrThrow({
          where: { id: pay1.id },
          select: { voidedAt: true },
        });
        const closingRow = await prisma.cashClosing.findUniqueOrThrow({
          where: { id: closingResult.id },
          select: { closedAt: true },
        });
        assert.ok(
          pay1Row.voidedAt && pay1Row.voidedAt > closingRow.closedAt,
          "R1: voidedAt debe ser estrictamente posterior a closedAt",
        );

        // Consultar el resumen como gerente: la caja sigue cerrada, muestra el ajuste posterior
        // y el total corregido junto al original
        const summaryClosed = await getCashSummary(testDate, manager);
        assert.equal(summaryClosed.isClosed, true);
        assert.equal(summaryClosed.closing?.totalAmount, "45000.00");
        assert.equal(summaryClosed.closing?.expectedCashAmount, "30000.00");
        assert.equal(summaryClosed.closing?.countedCashAmount, "28000.00");
        assert.equal(summaryClosed.closing?.difference, "-2000.00");
        assert.equal(summaryClosed.subsequentAdjustments.length, 1);
        assert.equal(summaryClosed.subsequentAdjustments[0].id, pay1.id);
        assert.equal(
          summaryClosed.correctedTotals?.correctedTotalAmount,
          "30000.00",
        );
        assert.equal(
          summaryClosed.correctedTotals?.correctedCashAmount,
          "15000.00",
        );
        assert.equal(summaryClosed.correctedTotals?.correctedPaymentCount, 2);

        // R2: Renombrar débito (isCash=false) a "Efectivo alternativo" y anularlo como gerente.
        // El flag Payment.isCash=false debe proteger el cálculo: correctedCashAmount NO debe caer a 0.
        await prisma.paymentMethod.update({
          where: { id: debit.id },
          data: { name: `${tag}-efectivo-alternativo` },
        });

        await voidPayment(
          { paymentId: payDebit.id, reason: "Corrección autorizada débito" },
          manager,
        );

        const summaryClosedR2 = await getCashSummary(testDate, manager);
        assert.equal(summaryClosedR2.subsequentAdjustments.length, 2);
        assert.equal(
          summaryClosedR2.correctedTotals?.correctedTotalAmount,
          "15000.00",
        );
        // Debe seguir siendo 15000.00 (el efectivo esperado restante), no 0.00
        assert.equal(
          summaryClosedR2.correctedTotals?.correctedCashAmount,
          "15000.00",
        );
        assert.equal(summaryClosedR2.correctedTotals?.correctedPaymentCount, 1);

        // Restaurar los nombres originales para no alterar verificaciones posteriores
        await prisma.paymentMethod.update({
          where: { id: cash.id },
          data: { name: `${tag}-efectivo` },
        });
        await prisma.paymentMethod.update({
          where: { id: debit.id },
          data: { name: `${tag}-debito` },
        });

        // listCashClosings funciona para gerente y falla para recepcionista
        const page1 = await listCashClosings(1, manager);
        assert.ok(page1.total > 0);
        let foundClosing = page1.items.some((c) => c.id === closingResult.id);
        let pageNum = 2;
        while (!foundClosing && pageNum <= page1.pageCount) {
          const next = await listCashClosings(pageNum, manager);
          foundClosing = next.items.some((c) => c.id === closingResult.id);
          pageNum++;
        }
        assert.ok(
          foundClosing,
          "El cierre creado debe aparecer en listCashClosings",
        );
        const closingItem = page1.items.find((c) => c.id === closingResult.id);
        if (closingItem) {
          assert.equal(closingItem.adjustmentsCount, 2);
          assert.equal(closingItem.correctedTotalAmount, "15000.00");
        }
        await rejects(() => listCashClosings(1, receptionist), "FORBIDDEN");

        // El turno del cobro anulado puede volver a cobrarse (HU-27)
        const newPay = await registerPayment(
          { appointmentId: appt1, paymentMethodId: cash.id },
          receptionist,
        );
        assert.ok(newPay.id);
      },
    );

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

    // 16. Concurrencia del cierre con un cobro (H1), una anulación de recepción (H2)
    // y una anulación de gerencia (R1). El orden en que se intercalan no es fijo,
    // así que se repite la carrera y se verifican invariantes que valen en cualquier
    // orden: el cierre confirma, ningún error llega crudo y la foto del cierre es
    // coherente con lo que quedó vinculado a la caja.
    await verify(
      "cierre concurrente con cobro (H1) y con anulación de recepción (H2) y gerencia (R1)",
      async () => {
        const isDomainError = (reason: unknown, codes: string[]) =>
          reason instanceof DomainError && codes.includes(reason.code);
        // VALIDATION es el mensaje de conflicto si se agotan los reintentos.
        const settledAs = (
          result: PromiseSettledResult<unknown>,
          codes: string[],
          label: string,
        ) => {
          if (result.status === "rejected")
            assert.ok(
              isDomainError(result.reason, [...codes, "VALIDATION"]),
              `${label}: error inesperado ${String(result.reason)}`,
            );
        };

        let daysAgo = 60;
        for (let round = 0; round < 5; round++) {
          let date = "";
          for (; daysAgo < 400 && !date; daysAgo++) {
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            const s = toLocalSlot(d).date;
            const [closings, payments] = await Promise.all([
              prisma.cashClosing.count({ where: { date: dateToDb(s) } }),
              prisma.payment.count({
                where: {
                  createdAt: {
                    gte: appointmentInstant(s, 0),
                    lt: appointmentInstant(s, 1440),
                  },
                },
              }),
            ]);
            if (closings === 0 && payments === 0) date = s;
          }
          assert.ok(date, "Se debe encontrar una fecha libre");

          const instant = new Date(appointmentInstant(date, 600));
          const [apptA, apptB, apptC] = [
            await appointment({ status: "COMPLETED", date }),
            await appointment({ status: "COMPLETED", date }),
            await appointment({ status: "COMPLETED", date }),
          ];
          const payA = await registerPayment(
            { appointmentId: apptA, paymentMethodId: cash.id, now: instant },
            receptionist,
          );
          const payB = await registerPayment(
            { appointmentId: apptB, paymentMethodId: cash.id, now: instant },
            receptionist,
          );

          const [closeRes, payRes, voidRecepRes, voidMgrRes] =
            await Promise.allSettled([
              closeCash(
                {
                  date,
                  countedCashAmount: 30000,
                  notes: "Cierre concurrente de prueba",
                },
                receptionist,
              ),
              registerPayment(
                {
                  appointmentId: apptC,
                  paymentMethodId: cash.id,
                  now: instant,
                },
                receptionist,
              ),
              voidPayment(
                { paymentId: payA.id, reason: "Anulación de recepción" },
                receptionist,
              ),
              voidPayment(
                { paymentId: payB.id, reason: "Anulación de gerencia" },
                manager,
              ),
            ]);

          assert.equal(
            closeRes.status,
            "fulfilled",
            `El cierre debe confirmar: ${closeRes.status === "rejected" ? String(closeRes.reason) : ""}`,
          );
          settledAs(payRes, ["CASH_CLOSED"], "Cobro");
          settledAs(voidRecepRes, ["FORBIDDEN"], "Anulación de recepción");
          settledAs(voidMgrRes, [], "Anulación de gerencia");

          const closing = await prisma.cashClosing.findUniqueOrThrow({
            where: { date: dateToDb(date) },
          });
          const dayPayments = await prisma.payment.findMany({
            where: {
              createdAt: {
                gte: appointmentInstant(date, 0),
                lt: appointmentInstant(date, 1440),
              },
            },
          });

          // H1: ningún cobro del día queda fuera de la caja cerrada.
          for (const p of dayPayments)
            assert.equal(p.cashClosingId, closing.id, "H1: cobro sin caja");
          if (payRes.status === "rejected")
            assert.ok(!dayPayments.some((p) => p.appointmentId === apptC));

          // La foto cuenta exactamente los cobros vigentes al cerrar: los que
          // siguen pagados más los anulados después del cierre (R1: una
          // anulación con voidedAt anterior al cierre no puede estar contada).
          const afterClose = (p: (typeof dayPayments)[number]) =>
            p.voidedAt !== null && p.voidedAt > closing.closedAt;
          const atClose = dayPayments.filter(
            (p) => p.status === "PAID" || afterClose(p),
          );
          assert.equal(closing.paymentCount, atClose.length, "R1: foto");

          // H2: recepción nunca anula después del cierre.
          for (const p of dayPayments.filter(afterClose))
            assert.equal(p.voidedById, manager.id, "H2: anulación tardía");

          // R1: la anulación de gerencia posterior al cierre figura como ajuste.
          const summary = await getCashSummary(date, manager);
          assert.deepEqual(
            summary.subsequentAdjustments.map((a) => a.id).sort(),
            dayPayments
              .filter(afterClose)
              .map((p) => p.id)
              .sort(),
          );
          assert.equal(
            summary.correctedTotals?.correctedPaymentCount,
            dayPayments.filter((p) => p.status === "PAID").length,
          );
        }
      },
    );

    console.log(`\n${passed} verificaciones de HU-21, HU-24 y HU-27 pasaron.`);
  } finally {
    const appointments = await prisma.appointment.findMany({
      where: { createdById: { in: users } },
      select: { id: true },
    });
    const appointmentIds = appointments.map((a) => a.id);
    await prisma.payment.deleteMany({
      where: {
        OR: [
          { appointmentId: { in: appointmentIds } },
          { createdById: { in: users } },
        ],
      },
    });
    await prisma.cashClosing.deleteMany({
      where: {
        closedById: { in: users },
      },
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
