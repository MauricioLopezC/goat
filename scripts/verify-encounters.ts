// Verificación de HU-25 sobre PostgreSQL local migrado:
// Registro de atención, autocompletado de turnos iniciados, unicidad,
// secreto médico para recepción/gerencia, y límites de edición por autor y plazo.
// Crea sus propios datos y los borra al finalizar.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { DomainError } from "../src/lib/actions";
import {
  createEncounter,
  getEncounter,
  updateEncounter,
} from "../src/lib/dal/encounters";
import { appointmentInstant } from "../src/lib/appointment-slots";
import { addDays, dateToDb, toLocalSlot } from "../src/lib/schedule";
import {
  AppointmentEventType,
  AppointmentStatus,
  CoverageType,
  DocumentType,
  Role,
} from "../src/generated/prisma/enums";
import type { Actor } from "../src/lib/dal/auth";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Esta verificación solo usa PostgreSQL local.",
  );
  assert.notEqual(process.env.NODE_ENV, "production");
  const tag = `HU25-${randomUUID()}`;
  const users: number[] = [],
    patients: number[] = [],
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
    // 1. Crear usuarios y actores de prueba
    const doctorUser1 = await prisma.user.create({
      data: {
        email: `${tag}-doc1@example.invalid`,
        passwordHash: "verification-disabled-login",
        firstName: "Dr. Uno",
        lastName: tag,
        role: Role.PROFESSIONAL,
      },
    });
    users.push(doctorUser1.id);

    const prof1 = await prisma.professional.create({
      data: {
        userId: doctorUser1.id,
        firstName: "Dr. Uno",
        lastName: tag,
        documentType: DocumentType.PASSPORT,
        documentNumber: `${tag}-prof-1`,
        licenseNumber: `MN-${tag}-1`,
        createdById: doctorUser1.id,
      },
    });

    const doctorUser2 = await prisma.user.create({
      data: {
        email: `${tag}-doc2@example.invalid`,
        passwordHash: "verification-disabled-login",
        firstName: "Dra. Dos",
        lastName: tag,
        role: Role.PROFESSIONAL,
      },
    });
    users.push(doctorUser2.id);

    await prisma.professional.create({
      data: {
        userId: doctorUser2.id,
        firstName: "Dra. Dos",
        lastName: tag,
        documentType: DocumentType.PASSPORT,
        documentNumber: `${tag}-prof-2`,
        licenseNumber: `MN-${tag}-2`,
        createdById: doctorUser1.id,
      },
    });

    const recepUser = await prisma.user.create({
      data: {
        email: `${tag}-recep@example.invalid`,
        passwordHash: "verification-disabled-login",
        firstName: "Recepcionista",
        lastName: tag,
        role: Role.RECEPTIONIST,
      },
    });
    users.push(recepUser.id);

    const doc1Actor: Actor = doctorUser1;
    const doc2Actor: Actor = doctorUser2;
    const recepActor: Actor = recepUser;

    // 2. Crear paciente y servicio
    const patient = await prisma.patient.create({
      data: {
        firstName: "Paciente",
        lastName: tag,
        gender: "OTHER",
        documentType: DocumentType.DNI,
        documentNumber: `T${Math.floor(10000000 + Math.random() * 80000000)}`,
        birthDate: dateToDb("2000-01-01"),
        phone: "0000000000",
        email: `${tag}@example.invalid`,
        coverageType: CoverageType.PRIVATE,
        createdById: doctorUser1.id,
      },
    });
    patients.push(patient.id);

    const service = await prisma.service.create({
      data: {
        name: `Consulta ${tag}`,
        durationMinutes: 30,
      },
    });
    services.push(service.id);

    const now = new Date();
    const today = toLocalSlot(now).date;

    // Helper para crear turnos de prueba
    async function makeAppointment(attrs: {
      professionalId: number;
      status: AppointmentStatus;
      startsAt: Date;
      endsAt: Date;
    }) {
      return prisma.appointment.create({
        data: {
          patientId: patient.id,
          serviceId: service.id,
          professionalId: attrs.professionalId,
          status: attrs.status,
          startsAt: attrs.startsAt,
          endsAt: attrs.endsAt,
          createdById: recepUser.id,
        },
      });
    }

    // --- PRUEBA 1: Roles y permisos de mutación ---
    await verify(
      "recepción no puede crear atenciones (FORBIDDEN)",
      async () => {
        const appt = await makeAppointment({
          professionalId: prof1.id,
          status: AppointmentStatus.COMPLETED,
          startsAt: appointmentInstant(today, 540), // 09:00
          endsAt: appointmentInstant(today, 570),
        });

        await rejects(
          () =>
            createEncounter(
              {
                appointmentId: appt.id,
                notes: "Intento de recepción",
              },
              recepActor,
            ),
          "FORBIDDEN",
        );
      },
    );

    // --- PRUEBA 2: Pertenencia del turno ---
    await verify(
      "un profesional no puede registrar atención sobre turno de otro profesional (FORBIDDEN)",
      async () => {
        const appt = await makeAppointment({
          professionalId: prof1.id,
          status: AppointmentStatus.COMPLETED,
          startsAt: appointmentInstant(today, 600), // 10:00
          endsAt: appointmentInstant(today, 630),
        });

        await rejects(
          () =>
            createEncounter(
              {
                appointmentId: appt.id,
                notes: "Atención cruzada",
              },
              doc2Actor,
            ),
          "FORBIDDEN",
        );
      },
    );

    // --- PRUEBA 3: Estados restringidos ---
    await verify(
      "no se registra atención sobre turnos cancelados o vencidos",
      async () => {
        const cancelledAppt = await makeAppointment({
          professionalId: prof1.id,
          status: AppointmentStatus.CANCELLED,
          startsAt: appointmentInstant(today, 660),
          endsAt: appointmentInstant(today, 690),
        });

        await rejects(
          () =>
            createEncounter(
              {
                appointmentId: cancelledAppt.id,
                notes: "Turno cancelado",
              },
              doc1Actor,
            ),
          "INVALID_STATUS_TRANSITION",
        );

        const expiredAppt = await makeAppointment({
          professionalId: prof1.id,
          status: AppointmentStatus.EXPIRED,
          startsAt: appointmentInstant(today, 700),
          endsAt: appointmentInstant(today, 730),
        });

        await rejects(
          () =>
            createEncounter(
              {
                appointmentId: expiredAppt.id,
                notes: "Turno vencido",
              },
              doc1Actor,
            ),
          "INVALID_STATUS_TRANSITION",
        );
      },
    );

    await verify(
      "no se registra atención sobre turno programado futuro aún no iniciado",
      async () => {
        const futureDate = addDays(today, 3);
        const futureAppt = await makeAppointment({
          professionalId: prof1.id,
          status: AppointmentStatus.SCHEDULED,
          startsAt: appointmentInstant(futureDate, 600),
          endsAt: appointmentInstant(futureDate, 630),
        });

        await rejects(
          () =>
            createEncounter(
              {
                appointmentId: futureAppt.id,
                notes: "Turno no iniciado aún",
              },
              doc1Actor,
            ),
          "INVALID_STATUS_TRANSITION",
        );
      },
    );

    // --- PRUEBA 4: Autocompletado y creación exitosa ---
    let createdEncounterId = 0;
    await verify(
      "al guardar la atención, el turno Programado iniciado pasa a Completado con evento en historial",
      async () => {
        // Turno iniciado hace 10 minutos
        const startedAppt = await makeAppointment({
          professionalId: prof1.id,
          status: AppointmentStatus.SCHEDULED,
          startsAt: new Date(Date.now() - 10 * 60_000),
          endsAt: new Date(Date.now() + 20 * 60_000),
        });

        const res = await createEncounter(
          {
            appointmentId: startedAppt.id,
            notes: "Paciente con tos seca persistente.",
            indications: "Radiografía de tórax y jarabe mucolítico.",
          },
          doc1Actor,
        );

        assert.ok(res.id > 0);
        createdEncounterId = res.id;

        // Verificar que el turno cambió a COMPLETED
        const reloaded = await prisma.appointment.findUnique({
          where: { id: startedAppt.id },
          include: { events: true },
        });

        assert.equal(reloaded?.status, AppointmentStatus.COMPLETED);

        // Verificar el evento en el historial
        const completeEvent = reloaded?.events.find(
          (e) => e.type === AppointmentEventType.COMPLETED,
        );
        assert.ok(completeEvent);
        assert.equal(completeEvent?.reason, "Atención médica registrada");
        assert.equal(completeEvent?.userId, doctorUser1.id);
      },
    );

    // --- PRUEBA 5: Unicidad (un turno tiene como máximo una atención) ---
    await verify(
      "no se permite duplicar la atención en el mismo turno (DUPLICATE)",
      async () => {
        const encounter = await prisma.encounter.findUnique({
          where: { id: createdEncounterId },
        });
        assert.ok(encounter);

        await rejects(
          () =>
            createEncounter(
              {
                appointmentId: encounter.appointmentId,
                notes: "Segunda atención en el mismo turno",
              },
              doc1Actor,
            ),
          "DUPLICATE",
        );
      },
    );

    // --- PRUEBA 6: Secreto médico y lectura según rol (getEncounter) ---
    await verify(
      "recepción solo ve que hay atención pero no el contenido clínico (secreto médico)",
      async () => {
        const encounter = await prisma.encounter.findUnique({
          where: { id: createdEncounterId },
        });

        const asRecep = await getEncounter(
          encounter!.appointmentId,
          recepActor,
        );
        assert.ok(asRecep);
        assert.equal(asRecep.hasEncounter, true);
        assert.equal(asRecep.notes, null);
        assert.equal(asRecep.indications, null);
        assert.equal(asRecep.canEdit, false);

        const asDoc = await getEncounter(encounter!.appointmentId, doc1Actor);
        assert.ok(asDoc);
        assert.equal(asDoc.hasEncounter, true);
        assert.equal(asDoc.notes, "Paciente con tos seca persistente.");
        assert.equal(
          asDoc.indications,
          "Radiografía de tórax y jarabe mucolítico.",
        );
        assert.equal(asDoc.canEdit, true);

        // Profesional ajeno que no atiende al paciente es rechazado con FORBIDDEN
        await rejects(
          () => getEncounter(encounter!.appointmentId, doc2Actor),
          "FORBIDDEN",
        );
      },
    );

    // --- PRUEBA 7: Edición por autor vs no autor ---
    await verify("solo el autor puede modificar la atención", async () => {
      // Otro profesional intenta editar
      await rejects(
        () =>
          updateEncounter(
            {
              encounterId: createdEncounterId,
              notes: "Edición no autorizada",
            },
            doc2Actor,
          ),
        "FORBIDDEN",
      );

      // El autor sí puede editar
      const updated = await updateEncounter(
        {
          encounterId: createdEncounterId,
          notes: "Paciente con tos seca y febrícula.",
          indications: "Radiografía de tórax y paracetamol.",
        },
        doc1Actor,
      );

      assert.equal(updated.id, createdEncounterId);

      const check = await prisma.encounter.findUnique({
        where: { id: createdEncounterId },
      });
      assert.equal(check?.notes, "Paciente con tos seca y febrícula.");
      assert.equal(check?.indications, "Radiografía de tórax y paracetamol.");
    });

    // --- PRUEBA 8: Plazo de edición (hasta fin del día siguiente) ---
    await verify(
      "no se puede modificar la atención si el plazo ya venció (DEADLINE_EXCEEDED)",
      async () => {
        // Creamos un turno de hace 4 días con su atención
        const oldDate = addDays(today, -4);
        const oldAppt = await makeAppointment({
          professionalId: prof1.id,
          status: AppointmentStatus.COMPLETED,
          startsAt: appointmentInstant(oldDate, 600),
          endsAt: appointmentInstant(oldDate, 630),
        });

        const oldEncounter = await prisma.encounter.create({
          data: {
            appointmentId: oldAppt.id,
            professionalId: prof1.id,
            notes: "Atención antigua",
          },
        });

        await rejects(
          () =>
            updateEncounter(
              {
                encounterId: oldEncounter.id,
                notes: "Intento de modificar después del plazo",
              },
              doc1Actor,
            ),
          "DEADLINE_EXCEEDED",
        );
      },
    );

    console.log(`\nTODAS LAS ${passed} PRUEBAS DE HU-25 PASARON EXITOSAMENTE.`);
  } finally {
    // Limpieza de datos creados
    await prisma.appointmentEvent.deleteMany({
      where: { appointment: { patient: { lastName: tag } } },
    });
    await prisma.encounter.deleteMany({
      where: { appointment: { patient: { lastName: tag } } },
    });
    await prisma.appointment.deleteMany({
      where: { patient: { lastName: tag } },
    });
    await prisma.professional.deleteMany({
      where: { lastName: tag },
    });
    await prisma.patient.deleteMany({
      where: { lastName: tag },
    });
    await prisma.service.deleteMany({
      where: { id: { in: services } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: users } },
    });
  }
}

main().catch((err) => {
  console.error("Error en verificación:", err);
  process.exit(1);
});
