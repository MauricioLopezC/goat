import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { assertRole, type Actor } from "@/lib/dal/auth";
import {
  AppointmentStatus,
  CoverageType,
  PaymentStatus,
  Role,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { appointmentInstant } from "@/lib/appointment-slots";
import { isCashPayment } from "@/lib/payments";
import { calculateCommission } from "@/lib/statements";
import {
  statementFilterSchema,
  type StatementFilterInput,
} from "@/lib/validation/statements";

// Rendición por profesional (HU-28).
// Producido: pacientes atendidos (turnos Completados).
// Cobrado: dinero ingresado por turnos a pacientes particulares (cobros vigentes PAID).
// Comisión: 15 % de lo cobrado.
// Neto: cobrado menos comisión.

export type ProfessionalStatementItem = {
  professionalId: number;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  active: boolean;
  patientsAttended: number;
  totalBilled: string;
  centerCommission: string;
  professionalNet: string;
};

export type CenterStatementTotals = {
  patientsAttended: number;
  totalBilled: string;
  centerCommission: string;
  professionalNet: string;
};

export type ServiceStatementBreakdown = {
  serviceId: number;
  serviceName: string;
  count: number;
};

export type CoverageStatementBreakdown = {
  coverageType: CoverageType;
  label: string;
  count: number;
};

export type PaymentMethodStatementBreakdown = {
  paymentMethodId: number;
  name: string;
  isCash: boolean;
  count: number;
  total: string;
};

export type AppointmentStatementRow = {
  id: number;
  startsAt: Date;
  endsAt: Date;
  patient: {
    id: number;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
  };
  service: {
    id: number;
    name: string;
    price: string;
  };
  coverage: {
    coverageType: CoverageType;
    label: string;
    memberNumber: string | null;
  };
  payment: {
    id: number;
    receiptNumber: number;
    amount: string;
    paymentMethodName: string;
    isCash: boolean;
    createdAt: Date;
  } | null;
  commission: string | null;
  net: string | null;
};

export type ProfessionalStatementDetail = {
  professional: {
    id: number;
    firstName: string;
    lastName: string;
    licenseNumber: string;
    active: boolean;
  };
  summary: ProfessionalStatementItem;
  byService: ServiceStatementBreakdown[];
  byCoverage: CoverageStatementBreakdown[];
  byPaymentMethod: PaymentMethodStatementBreakdown[];
  appointments: AppointmentStatementRow[];
};

export type ProfessionalOption = {
  id: number;
  firstName: string;
  lastName: string;
  active: boolean;
};

export type ProfessionalStatementResult = {
  period: { from: string; to: string };
  isManager: boolean;
  centerTotals: CenterStatementTotals | null;
  professionalsSummary: ProfessionalStatementItem[] | null;
  professionalOptions: ProfessionalOption[];
  selectedStatement: ProfessionalStatementDetail | null;
};

/**
 * Consulta la rendición por profesional para el período indicado (HU-28).
 * - MANAGER: ve todos los profesionales y totales del centro, o el detalle de uno seleccionado.
 * - PROFESSIONAL: ve únicamente su propia rendición detallada.
 * - RECEPTIONIST: sin acceso (bloqueado por assertRole).
 */
export async function getProfessionalStatement(
  input: StatementFilterInput,
  actor: Actor,
): Promise<ProfessionalStatementResult> {
  assertRole(actor, Role.MANAGER, Role.PROFESSIONAL);

  const parsed = statementFilterSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Revisá los filtros de fecha.",
    );
  }

  const { from, to, professionalId } = parsed.data;
  const isManager = actor.role === Role.MANAGER;

  // Un turno pertenece al período por su fecha de atención (startsAt en hora local del centro)
  const dayStart = appointmentInstant(from, 0);
  const dayEnd = appointmentInstant(to, 1440);

  // Determinar el profesional objetivo según el rol
  let targetProfessionalId: number | undefined;

  if (actor.role === Role.PROFESSIONAL) {
    const profProfile = await prisma.professional.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!profProfile) {
      throw new DomainError(
        "NOT_FOUND",
        "No se encontró el perfil del profesional autenticado.",
      );
    }
    // El profesional solo puede consultar su propia rendición
    if (professionalId && professionalId !== profProfile.id) {
      throw new DomainError(
        "FORBIDDEN",
        "Solo podés consultar tu propia rendición.",
      );
    }
    targetProfessionalId = profProfile.id;
  } else {
    // MANAGER puede consultar un profesional específico o todos
    targetProfessionalId = professionalId;
  }

  // Traer lista de profesionales disponibles para selector de gerencia
  const allProfessionals = await prisma.professional.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      licenseNumber: true,
      active: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const professionalOptions: ProfessionalOption[] = isManager
    ? allProfessionals.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        active: p.active,
      }))
    : [];

  // Buscar turnos completados en el período
  // Pertenencia temporal: el turno pertenece al período por startsAt, y su cobro también
  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: dayStart, lt: dayEnd },
      status: AppointmentStatus.COMPLETED,
      ...(targetProfessionalId ? { professionalId: targetProfessionalId } : {}),
    },
    include: {
      professional: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          licenseNumber: true,
          active: true,
        },
      },
      service: {
        select: { id: true, name: true, price: true },
      },
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentType: true,
          documentNumber: true,
          coverageType: true,
          coverage: {
            select: {
              memberNumber: true,
              insurancePlan: {
                select: {
                  name: true,
                  healthInsurer: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      },
      payments: {
        where: { status: PaymentStatus.PAID },
        include: {
          paymentMethod: {
            select: { id: true, name: true, isCash: true },
          },
        },
      },
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });

  // Agrupador por profesional
  type ProfAggregator = {
    professional: (typeof allProfessionals)[number];
    patientsAttended: number;
    totalBilledDec: Prisma.Decimal;
    appointments: typeof appointments;
  };

  const profMap = new Map<number, ProfAggregator>();

  if (isManager && !targetProfessionalId) {
    // Si el gerente ve todos, inicializar con todos los profesionales activos
    for (const p of allProfessionals) {
      profMap.set(p.id, {
        professional: p,
        patientsAttended: 0,
        totalBilledDec: new Prisma.Decimal(0),
        appointments: [],
      });
    }
  }

  for (const appt of appointments) {
    const pId = appt.professionalId;
    let entry = profMap.get(pId);
    if (!entry) {
      entry = {
        professional: appt.professional,
        patientsAttended: 0,
        totalBilledDec: new Prisma.Decimal(0),
        appointments: [],
      };
      profMap.set(pId, entry);
    }
    entry.patientsAttended++;
    entry.appointments.push(appt);

    // Sumar cobros vigentes de este turno
    const activePayment = appt.payments[0];
    if (activePayment) {
      entry.totalBilledDec = entry.totalBilledDec.add(activePayment.amount);
    }
  }

  // Generar el resumen de todos los profesionales (solo para MANAGER)
  let professionalsSummary: ProfessionalStatementItem[] | null = null;
  let centerTotals: CenterStatementTotals | null = null;

  if (isManager) {
    let centerAttended = 0;
    let centerBilledDec = new Prisma.Decimal(0);

    const summaryList: ProfessionalStatementItem[] = [];

    for (const entry of profMap.values()) {
      const { commission, net } = calculateCommission(entry.totalBilledDec);
      centerAttended += entry.patientsAttended;
      centerBilledDec = centerBilledDec.add(entry.totalBilledDec);

      summaryList.push({
        professionalId: entry.professional.id,
        firstName: entry.professional.firstName,
        lastName: entry.professional.lastName,
        licenseNumber: entry.professional.licenseNumber,
        active: entry.professional.active,
        patientsAttended: entry.patientsAttended,
        totalBilled: entry.totalBilledDec.toFixed(2),
        centerCommission: commission,
        professionalNet: net,
      });
    }

    summaryList.sort((a, b) =>
      a.lastName.localeCompare(b.lastName, "es-AR", { sensitivity: "base" }),
    );

    professionalsSummary = summaryList;

    const centerCommissionData = calculateCommission(centerBilledDec);
    centerTotals = {
      patientsAttended: centerAttended,
      totalBilled: centerBilledDec.toFixed(2),
      centerCommission: centerCommissionData.commission,
      professionalNet: centerCommissionData.net,
    };
  }

  // Generar el detalle de la rendición individual si hay un profesional seleccionado o si es PROFESSIONAL
  let selectedStatement: ProfessionalStatementDetail | null = null;

  if (targetProfessionalId) {
    const profTarget = allProfessionals.find(
      (p) => p.id === targetProfessionalId,
    );
    if (!profTarget) {
      throw new DomainError("NOT_FOUND", "El profesional no existe.");
    }

    const profAppointments = appointments.filter(
      (a) => a.professionalId === targetProfessionalId,
    );

    let profBilledDec = new Prisma.Decimal(0);
    const serviceMap = new Map<number, { name: string; count: number }>();
    const coverageMap = new Map<
      string,
      { coverageType: CoverageType; label: string; count: number }
    >();
    const methodMap = new Map<
      number,
      { name: string; isCash: boolean; count: number; total: Prisma.Decimal }
    >();

    const rows: AppointmentStatementRow[] = [];

    for (const appt of profAppointments) {
      // 1. Desglose por servicio
      const svc = serviceMap.get(appt.serviceId) ?? {
        name: appt.service.name,
        count: 0,
      };
      svc.count++;
      serviceMap.set(appt.serviceId, svc);

      // 2. Desglose por cobertura
      let covLabel = "Particular";
      if (appt.patient.coverageType === CoverageType.HEALTH_INSURANCE) {
        const insurerName =
          appt.patient.coverage?.insurancePlan.healthInsurer.name;
        const planName = appt.patient.coverage?.insurancePlan.name;
        covLabel =
          insurerName && planName
            ? `${insurerName} (${planName})`
            : (insurerName ?? "Obra Social");
      }

      const covKey = `${appt.patient.coverageType}-${covLabel}`;
      const cov = coverageMap.get(covKey) ?? {
        coverageType: appt.patient.coverageType,
        label: covLabel,
        count: 0,
      };
      cov.count++;
      coverageMap.set(covKey, cov);

      // 3. Cobro del turno
      const activePay = appt.payments[0] ?? null;
      let payData: AppointmentStatementRow["payment"] = null;
      let comm: string | null = null;
      let net: string | null = null;

      if (activePay) {
        profBilledDec = profBilledDec.add(activePay.amount);
        const { commission: cStr, net: nStr } = calculateCommission(
          activePay.amount,
        );
        comm = cStr;
        net = nStr;

        const isCash = isCashPayment(activePay);
        payData = {
          id: activePay.id,
          receiptNumber: activePay.receiptNumber,
          amount: activePay.amount.toFixed(2),
          paymentMethodName: activePay.paymentMethod.name,
          isCash,
          createdAt: activePay.createdAt,
        };

        // Desglose por medio de pago
        const m = methodMap.get(activePay.paymentMethodId) ?? {
          name: activePay.paymentMethod.name,
          isCash,
          count: 0,
          total: new Prisma.Decimal(0),
        };
        m.count++;
        m.total = m.total.add(activePay.amount);
        methodMap.set(activePay.paymentMethodId, m);
      }

      rows.push({
        id: appt.id,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        patient: {
          id: appt.patient.id,
          firstName: appt.patient.firstName,
          lastName: appt.patient.lastName,
          documentType: appt.patient.documentType,
          documentNumber: appt.patient.documentNumber,
        },
        service: {
          id: appt.service.id,
          name: appt.service.name,
          price: appt.service.price ? appt.service.price.toFixed(2) : "0.00",
        },
        coverage: {
          coverageType: appt.patient.coverageType,
          label: covLabel,
          memberNumber: appt.patient.coverage?.memberNumber ?? null,
        },
        payment: payData,
        commission: comm,
        net: net,
      });
    }

    const { commission: profComm, net: profNet } =
      calculateCommission(profBilledDec);

    const summaryItem: ProfessionalStatementItem = {
      professionalId: profTarget.id,
      firstName: profTarget.firstName,
      lastName: profTarget.lastName,
      licenseNumber: profTarget.licenseNumber,
      active: profTarget.active,
      patientsAttended: profAppointments.length,
      totalBilled: profBilledDec.toFixed(2),
      centerCommission: profComm,
      professionalNet: profNet,
    };

    const byService: ServiceStatementBreakdown[] = Array.from(
      serviceMap.entries(),
    )
      .map(([id, val]) => ({
        serviceId: id,
        serviceName: val.name,
        count: val.count,
      }))
      .sort(
        (a, b) =>
          b.count - a.count || a.serviceName.localeCompare(b.serviceName),
      );

    const byCoverage: CoverageStatementBreakdown[] = Array.from(
      coverageMap.values(),
    ).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const byPaymentMethod: PaymentMethodStatementBreakdown[] = Array.from(
      methodMap.entries(),
    )
      .map(([id, val]) => ({
        paymentMethodId: id,
        name: val.name,
        isCash: val.isCash,
        count: val.count,
        total: val.total.toFixed(2),
      }))
      .sort((a, b) => Number(b.total) - Number(a.total));

    selectedStatement = {
      professional: {
        id: profTarget.id,
        firstName: profTarget.firstName,
        lastName: profTarget.lastName,
        licenseNumber: profTarget.licenseNumber,
        active: profTarget.active,
      },
      summary: summaryItem,
      byService,
      byCoverage,
      byPaymentMethod,
      appointments: rows,
    };
  }

  return {
    period: { from, to },
    isManager,
    centerTotals,
    professionalsSummary,
    professionalOptions,
    selectedStatement,
  };
}
