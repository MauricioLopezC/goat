import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { serializableTransaction } from "@/lib/dal/transactions";
import { PaymentStatus, Role } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import {
  dateFromDb,
  dateToDb,
  isCalendarDate,
  toLocalSlot,
} from "@/lib/schedule";
import { appointmentInstant } from "@/lib/appointment-slots";
import { paginate, type Page } from "@/lib/pagination";
import { closeCashSchema, type CloseCashInput } from "@/lib/validation/cash";

// Arqueo y cierre diario de caja (HU-27).

export type PaymentMethodSummary = {
  paymentMethodId: number;
  paymentMethodName: string;
  count: number;
  total: string;
};

export type ProfessionalCashSummary = {
  professionalId: number;
  professionalName: string;
  count: number;
  total: string;
};

export type CashPaymentRow = {
  id: number;
  receiptNumber: number;
  amount: string;
  isCash?: boolean;
  paymentMethod: { id: number; name: string; isCash?: boolean };
  createdAt: Date;
  createdBy: { id: number; firstName: string; lastName: string };
  appointment: {
    id: number;
    patient: {
      id: number;
      firstName: string;
      lastName: string;
      documentType: string;
      documentNumber: string;
    };
    professional: { id: number; firstName: string; lastName: string };
    service: { id: number; name: string };
  };
};

export type VoidedPaymentRow = {
  id: number;
  receiptNumber: number;
  amount: string;
  isCash?: boolean;
  paymentMethod: { id: number; name: string; isCash?: boolean };
  createdAt: Date;
  voidedAt: Date | null;
  voidedBy: { id: number; firstName: string; lastName: string } | null;
  voidReason: string | null;
  appointment: {
    id: number;
    patient: {
      id: number;
      firstName: string;
      lastName: string;
      documentType: string;
      documentNumber: string;
    };
    professional: { id: number; firstName: string; lastName: string };
    service: { id: number; name: string };
  };
};

export type CashSummary = {
  date: string;
  isClosed: boolean;
  closing: {
    id: number;
    closedAt: Date;
    closedBy: { id: number; firstName: string; lastName: string };
    paymentCount: number;
    totalAmount: string;
    expectedCashAmount: string;
    countedCashAmount: string;
    difference: string;
    notes: string | null;
  } | null;
  summary: {
    paymentCount: number;
    totalAmount: string;
    expectedCashAmount: string;
    byPaymentMethod: PaymentMethodSummary[];
    byProfessional: ProfessionalCashSummary[];
  };
  payments: CashPaymentRow[];
  voidedPayments: VoidedPaymentRow[];
  subsequentAdjustments: VoidedPaymentRow[];
  correctedTotals: {
    correctedTotalAmount: string;
    correctedPaymentCount: number;
    correctedCashAmount: string;
    correctedDifference: string;
  } | null;
};

export type CashClosingListItem = {
  id: number;
  date: string;
  closedAt: Date;
  closedBy: { id: number; firstName: string; lastName: string };
  paymentCount: number;
  totalAmount: string;
  expectedCashAmount: string;
  countedCashAmount: string;
  difference: string;
  notes: string | null;
  adjustmentsCount: number;
  correctedTotalAmount: string;
};

import { isCashPayment } from "@/lib/payments";
export { isCashPayment };

function toVoidedRow(p: {
  id: number;
  receiptNumber: number;
  amount: Prisma.Decimal;
  isCash?: boolean;
  paymentMethod: { id: number; name: string; isCash?: boolean };
  createdAt: Date;
  voidedAt: Date | null;
  voidedBy: { id: number; firstName: string; lastName: string } | null;
  voidReason: string | null;
  appointment: {
    id: number;
    patient: {
      id: number;
      firstName: string;
      lastName: string;
      documentType: string;
      documentNumber: string;
    };
    professional: { id: number; firstName: string; lastName: string };
    service: { id: number; name: string };
  };
}): VoidedPaymentRow {
  return {
    id: p.id,
    receiptNumber: p.receiptNumber,
    amount: p.amount.toFixed(2),
    isCash: isCashPayment(p),
    paymentMethod: p.paymentMethod,
    createdAt: p.createdAt,
    voidedAt: p.voidedAt,
    voidedBy: p.voidedBy,
    voidReason: p.voidReason,
    appointment: p.appointment,
  };
}

/**
 * Consulta el resumen y estado de la caja de un día local (HU-27).
 * RECEPTIONIST y MANAGER pueden ver la caja de hoy y cajas abiertas.
 * MANAGER puede ver además cajas cerradas de cualquier fecha.
 */
export async function getCashSummary(
  dateStr: string,
  actor: Actor,
): Promise<CashSummary> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  if (!isCalendarDate(dateStr)) {
    throw new DomainError("VALIDATION", "La fecha ingresada es inválida.");
  }

  const closing = await prisma.cashClosing.findUnique({
    where: { date: dateToDb(dateStr) },
    include: {
      closedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  const todayStr = toLocalSlot(new Date()).date;
  // La recepcionista solo puede consultar la caja de hoy (abierta o cerrada) y cajas abiertas.
  // Las cajas cerradas de fechas anteriores son exclusivas del gerente.
  if (closing && dateStr !== todayStr && actor.role !== Role.MANAGER) {
    throw new DomainError(
      "FORBIDDEN",
      "Solo el gerente puede consultar cajas cerradas de fechas anteriores.",
    );
  }

  const dayStart = appointmentInstant(dateStr, 0);
  const dayEnd = appointmentInstant(dateStr, 1440);

  const paymentInclude = {
    paymentMethod: { select: { id: true, name: true, isCash: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true } },
    voidedBy: { select: { id: true, firstName: true, lastName: true } },
    appointment: {
      select: {
        id: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentType: true,
            documentNumber: true,
          },
        },
        professional: {
          select: { id: true, firstName: true, lastName: true },
        },
        service: { select: { id: true, name: true } },
      },
    },
  };

  type LoadedPayment = Prisma.PaymentGetPayload<{
    include: typeof paymentInclude;
  }>;

  let activePayments: LoadedPayment[] = [];
  const subsequentAdjustments: VoidedPaymentRow[] = [];
  let voidedPayments: VoidedPaymentRow[] = [];
  let paymentsAtClosing: LoadedPayment[] = [];

  if (closing) {
    // Caja cerrada: leemos los pagos asociados a este cierre
    const closingPayments = await prisma.payment.findMany({
      where: { cashClosingId: closing.id },
      include: paymentInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    activePayments = closingPayments.filter(
      (p) => p.status === PaymentStatus.PAID,
    );

    // Ajustes posteriores: pagos de esta caja cerrada anulados con posterioridad a closedAt
    for (const p of closingPayments) {
      if (
        p.status === PaymentStatus.VOIDED &&
        p.voidedAt &&
        p.voidedAt > closing.closedAt
      ) {
        subsequentAdjustments.push(toVoidedRow(p));
      }
    }

    // Cobros anulados en el día (anulados durante dateStr, pero no posteriores al cierre) (H4)
    const dayVoided = await prisma.payment.findMany({
      where: {
        voidedAt: { gte: dayStart, lt: dayEnd },
        status: PaymentStatus.VOIDED,
      },
      include: paymentInclude,
      orderBy: [{ voidedAt: "asc" }, { id: "asc" }],
    });

    const adjustmentIds = new Set(subsequentAdjustments.map((a) => a.id));
    for (const p of dayVoided) {
      if (!adjustmentIds.has(p.id)) {
        voidedPayments.push(toVoidedRow(p));
      }
    }

    paymentsAtClosing = closingPayments.filter(
      (p) =>
        p.status === PaymentStatus.PAID ||
        (p.voidedAt && p.voidedAt > closing.closedAt),
    );
  } else {
    // Caja abierta:
    // 1. Pagos activos creados en esa fecha
    activePayments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
        status: PaymentStatus.PAID,
      },
      include: paymentInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    // 2. Cobros anulados en el día (H4: se consulta por voidedAt dentro del día consultado)
    const dayVoided = await prisma.payment.findMany({
      where: {
        voidedAt: { gte: dayStart, lt: dayEnd },
        status: PaymentStatus.VOIDED,
      },
      include: paymentInclude,
      orderBy: [{ voidedAt: "asc" }, { id: "asc" }],
    });

    voidedPayments = dayVoided.map(toVoidedRow);
    paymentsAtClosing = activePayments;
  }

  const methodMap = new Map<
    number,
    { name: string; count: number; total: Prisma.Decimal }
  >();
  const profMap = new Map<
    number,
    { name: string; count: number; total: Prisma.Decimal }
  >();

  let calculatedTotal = new Prisma.Decimal(0);
  let calculatedExpectedCash = new Prisma.Decimal(0);

  for (const p of paymentsAtClosing) {
    calculatedTotal = calculatedTotal.add(p.amount);
    if (isCashPayment(p)) {
      calculatedExpectedCash = calculatedExpectedCash.add(p.amount);
    }

    // Medio de pago
    const m = methodMap.get(p.paymentMethodId) ?? {
      name: p.paymentMethod.name,
      count: 0,
      total: new Prisma.Decimal(0),
    };
    m.count++;
    m.total = m.total.add(p.amount);
    methodMap.set(p.paymentMethodId, m);

    // Profesional
    const profId = p.appointment.professional.id;
    const profName = `${p.appointment.professional.lastName}, ${p.appointment.professional.firstName}`;
    const pr = profMap.get(profId) ?? {
      name: profName,
      count: 0,
      total: new Prisma.Decimal(0),
    };
    pr.count++;
    pr.total = pr.total.add(p.amount);
    profMap.set(profId, pr);
  }

  const byPaymentMethod: PaymentMethodSummary[] = Array.from(
    methodMap.entries(),
  )
    .map(([id, data]) => ({
      paymentMethodId: id,
      paymentMethodName: data.name,
      count: data.count,
      total: data.total.toFixed(2),
    }))
    .sort((a, b) => a.paymentMethodName.localeCompare(b.paymentMethodName));

  const byProfessional: ProfessionalCashSummary[] = Array.from(
    profMap.entries(),
  )
    .map(([id, data]) => ({
      professionalId: id,
      professionalName: data.name,
      count: data.count,
      total: data.total.toFixed(2),
    }))
    .sort((a, b) => a.professionalName.localeCompare(b.professionalName));

  let correctedTotals: CashSummary["correctedTotals"] = null;

  if (closing) {
    let deductedTotal = new Prisma.Decimal(0);
    let deductedCash = new Prisma.Decimal(0);
    for (const adj of subsequentAdjustments) {
      const amt = new Prisma.Decimal(adj.amount);
      deductedTotal = deductedTotal.add(amt);
      if (isCashPayment(adj)) {
        deductedCash = deductedCash.add(amt);
      }
    }

    const correctedTotal = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      closing.totalAmount.sub(deductedTotal),
    );
    const correctedPaymentCount = Math.max(
      0,
      closing.paymentCount - subsequentAdjustments.length,
    );
    const correctedCash = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      closing.expectedCashAmount.sub(deductedCash),
    );
    const correctedDiff = closing.countedCashAmount.sub(correctedCash);

    correctedTotals = {
      correctedTotalAmount: correctedTotal.toFixed(2),
      correctedPaymentCount,
      correctedCashAmount: correctedCash.toFixed(2),
      correctedDifference: correctedDiff.toFixed(2),
    };
  }

  const paymentsFormatted: CashPaymentRow[] = activePayments.map((p) => ({
    id: p.id,
    receiptNumber: p.receiptNumber,
    amount: p.amount.toFixed(2),
    isCash: isCashPayment(p),
    paymentMethod: p.paymentMethod,
    createdAt: p.createdAt,
    createdBy: p.createdBy,
    appointment: p.appointment,
  }));

  return {
    date: dateStr,
    isClosed: closing !== null,
    closing: closing
      ? {
          id: closing.id,
          closedAt: closing.closedAt,
          closedBy: closing.closedBy,
          paymentCount: closing.paymentCount,
          totalAmount: closing.totalAmount.toFixed(2),
          expectedCashAmount: closing.expectedCashAmount.toFixed(2),
          countedCashAmount: closing.countedCashAmount.toFixed(2),
          difference: closing.difference.toFixed(2),
          notes: closing.notes,
        }
      : null,
    summary: {
      paymentCount: closing ? closing.paymentCount : paymentsAtClosing.length,
      totalAmount: closing
        ? closing.totalAmount.toFixed(2)
        : calculatedTotal.toFixed(2),
      expectedCashAmount: closing
        ? closing.expectedCashAmount.toFixed(2)
        : calculatedExpectedCash.toFixed(2),
      byPaymentMethod,
      byProfessional,
    },
    payments: paymentsFormatted,
    voidedPayments,
    subsequentAdjustments,
    correctedTotals,
  };
}

/**
 * Cierra la caja de un día (HU-27).
 * Realiza el arqueo de caja con el efectivo contado y vincula todos los pagos del día.
 */
export async function closeCash(
  input: CloseCashInput,
  actor: Actor,
): Promise<{ id: number; date: string }> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  const parsed = closeCashSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError("VALIDATION", "Revisá los datos ingresados.");
  }
  const { date, countedCashAmount, notes } = parsed.data;

  const todayStr = toLocalSlot(new Date()).date;
  if (date > todayStr) {
    throw new DomainError(
      "VALIDATION",
      "No se puede cerrar una caja de una fecha futura.",
    );
  }

  const existing = await prisma.cashClosing.findUnique({
    where: { date: dateToDb(date) },
    select: { id: true },
  });
  if (existing) {
    throw new DomainError("DUPLICATE", "La caja de este día ya fue cerrada.");
  }

  const dayStart = appointmentInstant(date, 0);
  const dayEnd = appointmentInstant(date, 1440);

  return serializableTransaction(async (tx) => {
    // Re-chequeo transaccional
    const current = await tx.cashClosing.findUnique({
      where: { date: dateToDb(date) },
      select: { id: true },
    });
    if (current) {
      throw new DomainError("DUPLICATE", "La caja de este día ya fue cerrada.");
    }

    const dayPayments = await tx.payment.findMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      include: {
        paymentMethod: { select: { id: true, name: true, isCash: true } },
      },
    });

    const paidPayments = dayPayments.filter(
      (p) => p.status === PaymentStatus.PAID,
    );

    const paymentCount = paidPayments.length;
    let totalAmount = new Prisma.Decimal(0);
    let expectedCashAmount = new Prisma.Decimal(0);

    for (const p of paidPayments) {
      totalAmount = totalAmount.add(p.amount);
      if (isCashPayment(p)) {
        expectedCashAmount = expectedCashAmount.add(p.amount);
      }
    }

    const countedCash = new Prisma.Decimal(countedCashAmount.toFixed(2));
    const difference = countedCash.sub(expectedCashAmount);

    if (!difference.isZero()) {
      if (!notes || notes.trim().length === 0) {
        throw new DomainError(
          "VALIDATION",
          "Las observaciones son obligatorias cuando existe diferencia entre el efectivo contado y el esperado.",
          {
            notes: [
              "Ingresá una observación explicando la diferencia de caja.",
            ],
          },
        );
      }
    }

    const closing = await tx.cashClosing.create({
      data: {
        date: dateToDb(date),
        paymentCount,
        totalAmount,
        expectedCashAmount,
        countedCashAmount: countedCash,
        difference,
        notes: notes ? notes.trim() : null,
        closedById: actor.id,
        closedAt: new Date(),
      },
      select: { id: true },
    });

    // Vinculamos todos los cobros de esa fecha local a la caja cerrada
    await tx.payment.updateMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      data: {
        cashClosingId: closing.id,
      },
    });

    return { id: closing.id, date };
  }, "La caja cambió mientras confirmabas el cierre. Actualizá la página y volvé a intentar.");
}

/**
 * Listado paginado de cierres de caja históricos (HU-27).
 * Solo accesible por el gerente.
 */
export async function listCashClosings(
  page: number,
  actor: Actor,
): Promise<Page<CashClosingListItem>> {
  assertRole(actor, Role.MANAGER);

  return paginate(
    page,
    () => prisma.cashClosing.count(),
    async ({ skip, take }) => {
      const closings = await prisma.cashClosing.findMany({
        skip,
        take,
        orderBy: [{ date: "desc" }, { id: "desc" }],
        include: {
          closedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          payments: {
            where: {
              status: PaymentStatus.VOIDED,
            },
            select: {
              amount: true,
              voidedAt: true,
            },
          },
        },
      });

      return closings.map((c) => {
        // Ajustes posteriores son aquellos anulados luego de closedAt
        const adjustments = c.payments.filter(
          (p) => p.voidedAt && p.voidedAt > c.closedAt,
        );
        const deducted = adjustments.reduce(
          (acc, p) => acc.add(p.amount),
          new Prisma.Decimal(0),
        );
        const correctedTotal = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          c.totalAmount.sub(deducted),
        );

        return {
          id: c.id,
          date: dateFromDb(c.date),
          closedAt: c.closedAt,
          closedBy: c.closedBy,
          paymentCount: c.paymentCount,
          totalAmount: c.totalAmount.toFixed(2),
          expectedCashAmount: c.expectedCashAmount.toFixed(2),
          countedCashAmount: c.countedCashAmount.toFixed(2),
          difference: c.difference.toFixed(2),
          notes: c.notes,
          adjustmentsCount: adjustments.length,
          correctedTotalAmount: correctedTotal.toFixed(2),
        };
      });
    },
  );
}

/**
 * Identifica días anteriores a hoy con cobros registrados pero sin cerrar (HU-27).
 * Se utiliza para la advertencia en "Turnos de hoy".
 */
export async function getUnclosedCashDays(actor: Actor): Promise<string[]> {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  const now = new Date();
  const todayStr = toLocalSlot(now).date;

  const todayStart = appointmentInstant(todayStr, 0);

  const [unclosedPayments, closings] = await Promise.all([
    prisma.payment.findMany({
      where: {
        createdAt: { lt: todayStart },
        cashClosingId: null,
      },
      select: { createdAt: true },
      distinct: ["createdAt"],
      orderBy: { createdAt: "asc" },
    }),
    prisma.cashClosing.findMany({
      select: { date: true },
    }),
  ]);

  const closedDates = new Set(closings.map((c) => dateFromDb(c.date)));

  const datesSet = new Set<string>();
  for (const p of unclosedPayments) {
    const d = toLocalSlot(p.createdAt).date;
    if (d < todayStr && !closedDates.has(d)) {
      datesSet.add(d);
    }
  }

  return Array.from(datesSet).sort();
}
