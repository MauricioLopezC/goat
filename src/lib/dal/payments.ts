import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { serializableTransaction } from "@/lib/dal/transactions";
import {
  AppointmentEventType,
  AppointmentStatus,
  CoverageType,
  PaymentStatus,
  Role,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { isChargeable, paymentState, type PaymentState } from "@/lib/payments";
import { appointmentInstant } from "@/lib/appointment-slots";
import { toLocalSlot } from "@/lib/schedule";
import {
  registerAuthorizationSchema,
  registerPaymentSchema,
  voidPaymentSchema,
  type RegisterAuthorizationInput,
  type RegisterPaymentInput,
  type VoidPaymentInput,
} from "@/lib/validation/payments";

// Cobro de turnos a particulares y autorización de obra social (HU-21).

const personSelect = { id: true, firstName: true, lastName: true } as const;

const billingSelect = {
  id: true,
  status: true,
  startsAt: true,
  authorizationNumber: true,
  authorizedAt: true,
  authorizedBy: { select: personSelect },
  patient: { select: { coverageType: true } },
  service: { select: { price: true, requiresReferral: true } },
  payments: {
    select: {
      id: true,
      amount: true,
      status: true,
      createdAt: true,
      createdBy: { select: personSelect },
      paymentMethod: { select: { name: true } },
      voidedAt: true,
      voidedBy: { select: personSelect },
      voidReason: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.AppointmentSelect;

type BillingRow = Prisma.AppointmentGetPayload<{
  select: typeof billingSelect;
}>;

function notChargeableError() {
  return new DomainError(
    "INVALID_STATUS_TRANSITION",
    "Solo se cobra o se autoriza un turno Programado de hoy o un turno Completado.",
  );
}

/// Datos de cobro y autorización para el detalle del turno. El profesional no
/// accede: la página no la llama para él y la DAL lo vuelve a verificar.
export async function getAppointmentBilling(
  appointmentId: number,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: billingSelect,
  });
  if (!appointment) throw new DomainError("NOT_FOUND", "El turno no existe.");
  return toBilling(appointment);
}

function toBilling(appointment: BillingRow) {
  const activePayment = appointment.payments.find(
    (payment) => payment.status === PaymentStatus.PAID,
  );
  const state = paymentState({
    coverageType: appointment.patient.coverageType,
    requiresReferral: appointment.service.requiresReferral,
    hasActivePayment: activePayment !== undefined,
    authorizationNumber: appointment.authorizationNumber,
  });
  return {
    state,
    chargeable: isChargeable(appointment),
    // Decimal no cruza a componentes cliente: va como texto ("15000.00").
    price: appointment.service.price?.toFixed(2) ?? null,
    activePayment: activePayment && {
      id: activePayment.id,
      amount: activePayment.amount.toFixed(2),
      paymentMethod: activePayment.paymentMethod.name,
      createdAt: activePayment.createdAt,
      createdBy: activePayment.createdBy,
    },
    voidedPayments: appointment.payments
      .filter((payment) => payment.status === PaymentStatus.VOIDED)
      .map((payment) => ({
        id: payment.id,
        amount: payment.amount.toFixed(2),
        paymentMethod: payment.paymentMethod.name,
        createdAt: payment.createdAt,
        createdBy: payment.createdBy,
        voidedAt: payment.voidedAt,
        voidedBy: payment.voidedBy,
        voidReason: payment.voidReason,
      })),
    authorization: appointment.authorizationNumber
      ? {
          number: appointment.authorizationNumber,
          at: appointment.authorizedAt,
          by: appointment.authorizedBy,
        }
      : null,
  };
}

/// Estado de cobro de varios turnos, para la marca del calendario. Solo
/// incluye los turnos habilitados (Programados de hoy y Completados) donde el
/// estado aplica.
export async function getPaymentStates(
  appointmentIds: number[],
  actor: Actor,
): Promise<Record<number, PaymentState>> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  if (appointmentIds.length === 0) return {};
  const appointments = await prisma.appointment.findMany({
    where: { id: { in: appointmentIds } },
    select: {
      id: true,
      status: true,
      startsAt: true,
      authorizationNumber: true,
      patient: { select: { coverageType: true } },
      service: { select: { requiresReferral: true } },
      payments: {
        where: { status: PaymentStatus.PAID },
        select: { id: true },
      },
    },
  });
  const now = new Date();
  const states: Record<number, PaymentState> = {};
  for (const appointment of appointments) {
    if (!isChargeable(appointment, now)) continue;
    const state = paymentState({
      coverageType: appointment.patient.coverageType,
      requiresReferral: appointment.service.requiresReferral,
      hasActivePayment: appointment.payments.length > 0,
      authorizationNumber: appointment.authorizationNumber,
    });
    if (state) states[appointment.id] = state;
  }
  return states;
}

/// Turnos de hoy (Programados y Completados) en los que aplica el cobro o la
/// autorización, para la pantalla Cobros del día.
export async function listTodayBilling(actor: Actor, now = new Date()) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const today = toLocalSlot(now).date;
  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: {
        gte: appointmentInstant(today, 0),
        lt: appointmentInstant(today, 1440),
      },
      status: {
        in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
      },
    },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      authorizationNumber: true,
      patient: {
        select: {
          firstName: true,
          lastName: true,
          documentType: true,
          documentNumber: true,
          coverageType: true,
        },
      },
      professional: { select: personSelect },
      service: { select: { name: true, price: true, requiresReferral: true } },
      payments: {
        where: { status: PaymentStatus.PAID },
        select: { amount: true, paymentMethod: { select: { name: true } } },
      },
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  return appointments.flatMap(({ payments, service, ...appointment }) => {
    const [activePayment] = payments;
    const state = paymentState({
      coverageType: appointment.patient.coverageType,
      requiresReferral: service.requiresReferral,
      hasActivePayment: activePayment !== undefined,
      authorizationNumber: appointment.authorizationNumber,
    });
    if (!state) return [];
    return [
      {
        ...appointment,
        state,
        service: { name: service.name },
        // Decimal no cruza a componentes cliente: va como texto ("15000.00").
        price: service.price?.toFixed(2) ?? null,
        activePayment: activePayment && {
          amount: activePayment.amount.toFixed(2),
          paymentMethod: activePayment.paymentMethod.name,
        },
      },
    ];
  });
}

export async function registerPayment(
  input: RegisterPaymentInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = registerPaymentSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los datos ingresados.");
  const { appointmentId, paymentMethodId } = parsed.data;
  try {
    return await serializableTransaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          status: true,
          startsAt: true,
          patient: { select: { coverageType: true } },
          service: { select: { price: true } },
          payments: {
            where: { status: PaymentStatus.PAID },
            select: { id: true },
          },
        },
      });
      if (!appointment)
        throw new DomainError("NOT_FOUND", "El turno no existe.");
      if (!isChargeable(appointment)) throw notChargeableError();
      if (appointment.patient.coverageType !== CoverageType.PRIVATE)
        throw new DomainError(
          "PATIENT_HAS_HEALTH_INSURANCE",
          "El paciente tiene obra social: no se le cobra. Registrá la autorización si el servicio requiere orden.",
        );
      if (appointment.service.price === null)
        throw new DomainError(
          "SERVICE_WITHOUT_PRICE",
          "El servicio no tiene valor cargado. Pedile al gerente que lo cargue en Servicios.",
        );
      if (appointment.payments.length > 0) throw alreadyPaidError();
      const method = await tx.paymentMethod.findUnique({
        where: { id: paymentMethodId },
        select: { active: true },
      });
      if (!method?.active)
        throw new DomainError(
          "VALIDATION",
          "El medio de pago elegido no está disponible.",
          { paymentMethodId: ["Elegí un medio de pago activo."] },
        );
      const payment = await tx.payment.create({
        data: {
          appointmentId,
          paymentMethodId,
          // El monto del momento: si después cambia el valor, el cobro no.
          amount: appointment.service.price,
          createdById: actor.id,
        },
        select: { id: true, amount: true },
      });
      return { id: payment.id, amount: payment.amount.toFixed(2) };
    });
  } catch (error) {
    // Dos cobros a la vez: el índice parcial deja pasar uno solo.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw alreadyPaidError();
    throw error;
  }
}

function alreadyPaidError() {
  return new DomainError(
    "APPOINTMENT_ALREADY_PAID",
    "El turno ya tiene un cobro registrado. Si se cargó mal, anulalo antes de volver a cobrar.",
  );
}

export async function voidPayment(input: VoidPaymentInput, actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = voidPaymentSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los datos ingresados.");
  const { paymentId, reason } = parsed.data;
  if (reason.length === 0)
    throw new DomainError(
      "REASON_REQUIRED",
      "El motivo de la anulación es obligatorio.",
    );
  return prisma.$transaction(async (tx) => {
    // La condición de estado va en el mismo UPDATE: dos anulaciones a la vez
    // no se pisan.
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PAID },
      data: {
        status: PaymentStatus.VOIDED,
        voidedAt: new Date(),
        voidedById: actor.id,
        voidReason: reason,
      },
    });
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, appointmentId: true },
    });
    if (!payment) throw new DomainError("NOT_FOUND", "El cobro no existe.");
    if (count === 0)
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        "El cobro ya estaba anulado.",
      );
    return payment;
  });
}

export async function registerAuthorization(
  input: RegisterAuthorizationInput,
  actor: Actor,
) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);
  const parsed = registerAuthorizationSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError("VALIDATION", "Revisá los datos ingresados.");
  const { appointmentId, authorizationNumber } = parsed.data;
  return serializableTransaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        status: true,
        startsAt: true,
        authorizationNumber: true,
        patient: { select: { coverageType: true } },
        service: { select: { requiresReferral: true } },
      },
    });
    if (!appointment) throw new DomainError("NOT_FOUND", "El turno no existe.");
    if (!isChargeable(appointment)) throw notChargeableError();
    if (
      appointment.patient.coverageType !== CoverageType.HEALTH_INSURANCE ||
      !appointment.service.requiresReferral
    )
      throw new DomainError(
        "AUTHORIZATION_NOT_REQUIRED",
        "La autorización solo se registra si el paciente tiene obra social y el servicio requiere orden.",
      );
    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        authorizationNumber,
        authorizedAt: new Date(),
        authorizedById: actor.id,
      },
    });
    // Corrección: el número anterior queda en el historial del turno.
    const previous = appointment.authorizationNumber;
    if (previous && previous !== authorizationNumber)
      await tx.appointmentEvent.create({
        data: {
          appointmentId,
          type: AppointmentEventType.UPDATED,
          reason: `Autorización corregida. Número anterior: ${previous}.`,
          userId: actor.id,
        },
      });
    return { id: appointmentId, authorizationNumber };
  });
}

/// Un turno con cobro vigente no se cancela, no se reprograma ni se marca
/// Vencido (HU-21). Se llama dentro de la transacción de esas operaciones.
export async function assertNoActivePayment(
  tx: Prisma.TransactionClient,
  appointmentId: number,
  action: string,
) {
  const active = await tx.payment.findFirst({
    where: { appointmentId, status: PaymentStatus.PAID },
    select: { id: true },
  });
  if (active)
    throw new DomainError(
      "APPOINTMENT_HAS_PAYMENT",
      `El turno tiene un cobro registrado. Anulá el cobro antes de ${action}.`,
    );
}
