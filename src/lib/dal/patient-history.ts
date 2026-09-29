import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import {
  AppointmentStatus,
  PaymentStatus,
  Role,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { paginate, type Page } from "@/lib/pagination";
import {
  patientAppointmentHistorySchema,
  type PatientAppointmentHistoryInput,
} from "@/lib/validation/patient-history";

// Historial de turnos del paciente (HU-18). El alcance del profesional lo
// aplica esta función: la pantalla no filtra nada por su cuenta.

const personSelect = { id: true, firstName: true, lastName: true } as const;

const historySelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  notes: true,
  priority: true,
  priorityReason: true,
  createdAt: true,
  service: { select: { id: true, name: true } },
  professional: { select: personSelect },
  createdBy: { select: personSelect },
  events: {
    select: {
      id: true,
      type: true,
      reason: true,
      requestedBy: true,
      createdAt: true,
      previousStartsAt: true,
      newStartsAt: true,
      previousProfessional: { select: personSelect },
      newProfessional: { select: personSelect },
      previousPriority: true,
      newPriority: true,
      user: { select: personSelect },
    },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.AppointmentSelect;

type HistoryAppointment = Prisma.AppointmentGetPayload<{
  select: typeof historySelect;
}>;

/// Cobro vigente del turno (HU-21). El monto viaja como texto: `Decimal` no
/// se serializa a componentes cliente.
export type HistoryPayment = {
  amount: string;
  paymentMethod: string;
  createdAt: Date;
  createdBy: { id: number; firstName: string; lastName: string };
};

export type HistoryItem = HistoryAppointment & {
  /// Siempre `null` para el profesional: el cobro no se le consulta.
  payment: HistoryPayment | null;
};

export type PatientAppointmentHistory = {
  page: Page<HistoryItem>;
  /// Completados y Vencidos del alcance visible, sin el filtro de estado.
  attendance: { completed: number; expired: number };
  /// Opciones del filtro de profesional; vacío para el profesional.
  professionals: { id: number; firstName: string; lastName: string }[];
};

export async function getPatientAppointmentHistory(
  input: PatientAppointmentHistoryInput,
  actor: Actor,
): Promise<PatientAppointmentHistory> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER, Role.PROFESSIONAL);
  const parsed = patientAppointmentHistorySchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "VALIDATION",
      "Revisá los filtros del historial de turnos.",
    );
  const { patientId, status, professionalId, page } = parsed.data;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true },
  });
  if (!patient) throw new DomainError("NOT_FOUND", "El paciente no existe.");

  const isProfessional = actor.role === Role.PROFESSIONAL;
  let scopedProfessionalId = professionalId;
  if (isProfessional) {
    // Pertenencia: el profesional solo ve los turnos del paciente con él.
    const own = await prisma.professional.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!own || (professionalId !== undefined && professionalId !== own.id))
      throw new DomainError(
        "FORBIDDEN",
        "Solo podés ver los turnos del paciente con vos.",
      );
    scopedProfessionalId = own.id;
  }

  const scope: Prisma.AppointmentWhereInput = {
    patientId,
    ...(scopedProfessionalId !== undefined
      ? { professionalId: scopedProfessionalId }
      : {}),
  };
  const where: Prisma.AppointmentWhereInput = {
    ...scope,
    ...(status ? { status } : {}),
  };

  const [appointments, attendanceRows, professionals] = await Promise.all([
    paginate(
      page,
      () => prisma.appointment.count({ where }),
      (range) =>
        prisma.appointment.findMany({
          where,
          select: historySelect,
          // El `id` desempata para que ningún turno salte de página.
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
          ...range,
        }),
    ),
    prisma.appointment.groupBy({
      by: ["status"],
      where: {
        ...scope,
        status: {
          in: [AppointmentStatus.COMPLETED, AppointmentStatus.EXPIRED],
        },
      },
      _count: { _all: true },
    }),
    isProfessional
      ? Promise.resolve([])
      : prisma.professional.findMany({
          where: { appointments: { some: { patientId } } },
          select: personSelect,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        }),
  ]);

  const payments = isProfessional
    ? new Map<number, HistoryPayment>()
    : await currentPayments(appointments.items.map((item) => item.id));

  const count = (target: AppointmentStatus) =>
    attendanceRows.find((row) => row.status === target)?._count._all ?? 0;

  return {
    page: {
      ...appointments,
      items: appointments.items.map((item) => ({
        ...item,
        payment: payments.get(item.id) ?? null,
      })),
    },
    attendance: {
      completed: count(AppointmentStatus.COMPLETED),
      expired: count(AppointmentStatus.EXPIRED),
    },
    professionals,
  };
}

/// Cobro vigente (`PAID`) de cada turno de la página. Los anulados no se
/// muestran en el historial.
async function currentPayments(appointmentIds: number[]) {
  const payments =
    appointmentIds.length === 0
      ? []
      : await prisma.payment.findMany({
          where: {
            appointmentId: { in: appointmentIds },
            status: PaymentStatus.PAID,
          },
          select: {
            appointmentId: true,
            amount: true,
            createdAt: true,
            paymentMethod: { select: { name: true } },
            createdBy: { select: personSelect },
          },
        });
  return new Map<number, HistoryPayment>(
    payments.map((payment) => [
      payment.appointmentId,
      {
        amount: payment.amount.toFixed(2),
        paymentMethod: payment.paymentMethod.name,
        createdAt: payment.createdAt,
        createdBy: payment.createdBy,
      },
    ]),
  );
}
