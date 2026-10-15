// Verificación de HU-31 y HU-32 sobre PostgreSQL local migrado: acceso al portal del
// paciente, clave temporal, cambio de contraseña, listado de turnos propios,
// cancelación con anticipación mínima de 24 h, comprobantes, y reserva de turnos
// desde el portal (HU-32: franjas, límite de 2 turnos, sin orden médica, concurrencia).
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
  createAppointment,
  getPortalBookingOptions,
  listAppointments,
  listAvailableDates,
  listAvailableSlots,
  listEarliestSlots,
  listMyAppointments,
} from "../src/lib/dal/appointments";
import { getPaymentReceipt, registerPayment } from "../src/lib/dal/payments";
import {
  AppointmentEventType,
  AppointmentPriority,
  AppointmentStatus,
  CoverageType,
  DocumentType,
  Gender,
  Role,
  Weekday,
} from "../src/generated/prisma/enums";
import { dateToDb, toLocalSlot } from "../src/lib/schedule";

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

        // Un paciente con contraseña temporal pendiente no puede cancelar ni listar turnos (HU-31)
        await rejects(
          () =>
            cancelAppointment(
              { appointmentId: 1, reason: "Intento previo al cambio de clave" },
              patientActorA,
            ),
          "FORBIDDEN",
        );
        await rejects(() => listMyAppointments(patientActorA), "FORBIDDEN");

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
            startsAt: new Date(past24h.getTime() - 3600_000),
            endsAt: new Date(past24h.getTime() - 3600_000 + 30 * 60_000),
            status: AppointmentStatus.COMPLETED,
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

    await verify(
      "HU-32: sacar turno desde el portal, reglas de negocio, límite de 2 turnos y concurrencia",
      async () => {
        // Setup: paciente B con credenciales definitivas y paciente C con clave temporal pendiente
        const enableB = await enablePatientAccess(
          { patientId: patientB.id },
          receptionist,
        );
        userIds.push(enableB.userId);
        await changePassword(
          {
            currentPassword: enableB.temporaryPassword,
            newPassword: "PasswordB123",
            confirmPassword: "PasswordB123",
          },
          {
            id: enableB.userId,
            email: enableB.email,
            firstName: patientB.firstName,
            lastName: patientB.lastName,
            role: Role.PATIENT,
            mustChangePassword: true,
          },
        );
        const patientActorB: Actor = {
          id: enableB.userId,
          email: enableB.email,
          firstName: patientB.firstName,
          lastName: patientB.lastName,
          role: Role.PATIENT,
          mustChangePassword: false,
        };

        const patientC = await prisma.patient.create({
          data: {
            firstName: "Carolina",
            lastName: "PortalC",
            documentType: DocumentType.DNI,
            documentNumber: String(Number(docBase) + 2),
            birthDate: new Date("1995-12-10T00:00:00.000Z"),
            gender: Gender.FEMALE,
            phone: "1155550003",
            email: `${tag.toLowerCase()}-pac-c@example.invalid`,
            coverageType: CoverageType.PRIVATE,
            createdById: receptionist.id,
          },
        });
        patientIds.push(patientC.id);

        const enableC = await enablePatientAccess(
          { patientId: patientC.id },
          receptionist,
        );
        userIds.push(enableC.userId);
        const patientActorTemp: Actor = {
          id: enableC.userId,
          email: enableC.email,
          firstName: patientC.firstName,
          lastName: patientC.lastName,
          role: Role.PATIENT,
          mustChangePassword: true,
        };

        // Servicio que requiere orden médica
        const serviceWithReferral = await prisma.service.create({
          data: {
            name: `${tag}-con-orden`,
            durationMinutes: 30,
            price: "24000.00",
            requiresReferral: true,
          },
        });
        serviceIds.push(serviceWithReferral.id);

        // Conectar el profesional a ambos servicios
        await prisma.professional.update({
          where: { id: professionalId },
          data: {
            services: {
              connect: [{ id: service.id }, { id: serviceWithReferral.id }],
            },
          },
        });

        // Crear franjas horarias de atención para el profesional de 08:00 a 20:00 todos los días
        for (const weekday of [
          Weekday.MONDAY,
          Weekday.TUESDAY,
          Weekday.WEDNESDAY,
          Weekday.THURSDAY,
          Weekday.FRIDAY,
          Weekday.SATURDAY,
          Weekday.SUNDAY,
        ]) {
          await prisma.availabilityWindow.create({
            data: {
              professionalId,
              weekday,
              startMinute: 480, // 08:00
              endMinute: 1200, // 20:00
            },
          });
        }

        // Buscar una fecha hábil próxima sin feriado (al menos 7 días adelante para cumplir ventana de cancelación)
        let day = new Date();
        day.setUTCDate(day.getUTCDate() + 7);
        while (
          await prisma.holiday.findFirst({
            where: { startDate: dateToDb(toLocalSlot(day).date) },
          })
        ) {
          day = new Date(day.getTime() + 86_400_000);
        }
        const targetDate = toLocalSlot(day).date;

        // 1. Bloqueo de operaciones para paciente con clave temporal pendiente (assertPasswordNotTemporary)
        await rejects(
          () => getPortalBookingOptions(patientActorTemp),
          "FORBIDDEN",
        );
        await rejects(
          () =>
            createAppointment(
              {
                patientId: patientC.id,
                professionalId,
                serviceId: service.id,
                date: targetDate,
                startTime: "09:00",
              },
              patientActorTemp,
            ),
          "FORBIDDEN",
        );
        await rejects(
          () =>
            listAvailableDates(
              { serviceId: service.id, professionalId, patientId: patientC.id },
              patientActorTemp,
            ),
          "FORBIDDEN",
        );
        await rejects(
          () =>
            listAvailableSlots(
              {
                serviceId: service.id,
                professionalId,
                date: targetDate,
                patientId: patientC.id,
              },
              patientActorTemp,
            ),
          "FORBIDDEN",
        );
        await rejects(
          () =>
            listEarliestSlots(
              { serviceId: service.id, patientId: patientC.id },
              patientActorTemp,
            ),
          "FORBIDDEN",
        );

        // 2. Servicios que requieren orden médica: excluidos del portal
        const portalOptions = await getPortalBookingOptions(patientActorA);
        assert.ok(
          portalOptions.services.some((s) => s.id === service.id),
          "El servicio sin orden debe estar disponible",
        );
        assert.ok(
          !portalOptions.services.some((s) => s.id === serviceWithReferral.id),
          "El servicio con orden médica NO debe aparecer en el portal",
        );

        await rejects(
          () =>
            createAppointment(
              {
                patientId: patientA.id,
                professionalId,
                serviceId: serviceWithReferral.id,
                date: targetDate,
                startTime: "09:00",
              },
              patientActorA,
            ),
          "VALIDATION",
        );
        await rejects(
          () =>
            listAvailableDates(
              {
                serviceId: serviceWithReferral.id,
                professionalId,
                patientId: patientA.id,
              },
              patientActorA,
            ),
          "VALIDATION",
        );
        await rejects(
          () =>
            listAvailableSlots(
              {
                serviceId: serviceWithReferral.id,
                professionalId,
                date: targetDate,
                patientId: patientA.id,
              },
              patientActorA,
            ),
          "VALIDATION",
        );
        await rejects(
          () =>
            listEarliestSlots(
              {
                serviceId: serviceWithReferral.id,
                patientId: patientA.id,
              },
              patientActorA,
            ),
          "VALIDATION",
        );

        // 3. Intento de reservar turno para otro paciente: FORBIDDEN
        await rejects(
          () =>
            createAppointment(
              {
                patientId: patientB.id,
                professionalId,
                serviceId: service.id,
                date: targetDate,
                startTime: "09:00",
              },
              patientActorA,
            ),
          "FORBIDDEN",
        );

        // 4. Intento de solicitar turno con prioridad urgente: VALIDATION
        await rejects(
          () =>
            createAppointment(
              {
                patientId: patientA.id,
                professionalId,
                serviceId: service.id,
                date: targetDate,
                startTime: "09:00",
                priority: AppointmentPriority.URGENT,
              },
              patientActorA,
            ),
          "VALIDATION",
        );

        // 5. Reserva válida desde el portal: listEarliestSlots y createAppointment
        const earliest = await listEarliestSlots(
          { serviceId: service.id, patientId: patientA.id },
          patientActorA,
        );
        assert.ok(
          earliest.length > 0,
          "Debe haber al menos un primer horario disponible",
        );

        const availableSlots = await listAvailableSlots(
          {
            serviceId: service.id,
            professionalId,
            date: targetDate,
            patientId: patientA.id,
          },
          patientActorA,
        );
        assert.ok(
          availableSlots.length >= 4,
          "Debe haber múltiples horarios disponibles en el día",
        );
        const [slot0, slot1, slot2] = availableSlots;

        // Reserva exitosa del primer turno
        const appt1 = await createAppointment(
          {
            patientId: patientA.id,
            professionalId,
            serviceId: service.id,
            date: targetDate,
            startTime: slot0.startTime,
            notes: "Reserva web particular",
          },
          patientActorA,
        );
        const appt1Record = await prisma.appointment.findUniqueOrThrow({
          where: { id: appt1.id },
        });
        assert.equal(appt1Record.createdById, patientActorA.id);
        assert.equal(appt1Record.priority, AppointmentPriority.NORMAL);
        assert.equal(appt1Record.status, AppointmentStatus.SCHEDULED);

        // Visible en Mis turnos (HU-31)
        const myApptsAfter1 = await listMyAppointments(patientActorA);
        assert.ok(
          myApptsAfter1.upcoming.some((a) => a.id === appt1.id),
          "El turno creado debe figurar en los próximos turnos del paciente",
        );

        // Visible en la agenda del centro con trazabilidad del portal
        const centerAppts = await listAppointments(
          { from: targetDate, to: targetDate },
          receptionist,
        );
        const centerItem = centerAppts.find((a) => a.id === appt1.id);
        assert.ok(centerItem, "El turno debe figurar en la agenda del centro");
        assert.equal(
          centerItem.createdBy.role,
          Role.PATIENT,
          "Debe registrar que fue creado por un paciente desde el portal",
        );

        // 6. Límite de 2 turnos futuros desde el portal
        const optsWith1 = await getPortalBookingOptions(patientActorA);
        assert.equal(optsWith1.futureAppointmentsCount, 1);
        assert.equal(optsWith1.canBook, true);

        // Reserva exitosa del segundo turno futuro
        const appt2 = await createAppointment(
          {
            patientId: patientA.id,
            professionalId,
            serviceId: service.id,
            date: targetDate,
            startTime: slot1.startTime,
          },
          patientActorA,
        );
        const appt2Record = await prisma.appointment.findUniqueOrThrow({
          where: { id: appt2.id },
        });
        assert.equal(appt2Record.createdById, patientActorA.id);

        const optsWith2 = await getPortalBookingOptions(patientActorA);
        assert.equal(optsWith2.futureAppointmentsCount, 2);
        assert.equal(optsWith2.canBook, false);

        // Intento de reservar un 3er turno futuro -> PORTAL_APPOINTMENT_LIMIT
        await rejects(
          () =>
            createAppointment(
              {
                patientId: patientA.id,
                professionalId,
                serviceId: service.id,
                date: targetDate,
                startTime: slot2.startTime,
              },
              patientActorA,
            ),
          "PORTAL_APPOINTMENT_LIMIT",
        );

        // 7. Prueba de concurrencia: dos pacientes compiten por el mismo slot simultáneamente
        // Paciente A cancela appt2 para recuperar cupo
        await cancelAppointment(
          { appointmentId: appt2.id, reason: "Libero turno para prueba" },
          patientActorA,
        );

        // Ambos pacientes intentan reservar slot2 al mismo instante
        const [resA, resB] = await Promise.allSettled([
          createAppointment(
            {
              patientId: patientA.id,
              professionalId,
              serviceId: service.id,
              date: targetDate,
              startTime: slot2.startTime,
            },
            patientActorA,
          ),
          createAppointment(
            {
              patientId: patientB.id,
              professionalId,
              serviceId: service.id,
              date: targetDate,
              startTime: slot2.startTime,
            },
            patientActorB,
          ),
        ]);

        const fulfilled = [resA, resB].filter((r) => r.status === "fulfilled");
        const rejected = [resA, resB].filter((r) => r.status === "rejected");
        assert.equal(
          fulfilled.length,
          1,
          "Exactamente uno de los dos pacientes debe conseguir el turno",
        );
        assert.equal(
          rejected.length,
          1,
          "El otro paciente debe recibir error por superposición/conflicto",
        );
        const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
        assert.ok(
          rejectedReason instanceof DomainError &&
            rejectedReason.code === "APPOINTMENT_OVERLAP",
          `Se esperaba APPOINTMENT_OVERLAP, pero se obtuvo: ${rejectedReason?.code}`,
        );
      },
    );

    console.log(`\nHU-31 y HU-32 verificados: ${passed} bloques OK.`);
  } finally {
    if (patientIds.length > 0 || professionalId > 0) {
      await prisma.payment.deleteMany({
        where: { appointment: { patientId: { in: patientIds } } },
      });
      await prisma.appointmentEvent.deleteMany({
        where: {
          OR: [
            { appointment: { patientId: { in: patientIds } } },
            { appointment: { professionalId } },
          ],
        },
      });
      await prisma.appointment.deleteMany({
        where: {
          OR: [{ patientId: { in: patientIds } }, { professionalId }],
        },
      });
      await prisma.availabilityWindow.deleteMany({
        where: { professionalId },
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
