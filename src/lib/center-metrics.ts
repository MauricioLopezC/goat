import type { AppointmentStatus, Weekday } from "@/generated/prisma/enums";
import {
  monthOf,
  periodMonthCount,
  rate,
  shiftMonthKey,
  type IndicatorPeriod,
} from "@/lib/indicators";
import { toLocalSlot, weekdayOf } from "@/lib/schedule";

export type CenterAppointment = {
  professionalId: number;
  patientId: number;
  serviceId: number;
  serviceName: string;
  specialtyId: number | null;
  specialtyName: string | null;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
};

export type CenterPayment = {
  createdAt: Date;
  methodName: string;
  amountCents: number;
};

export type ProfessionalLoad = {
  id: number;
  distinctPatients: number;
  workedMinutes: number;
  patientsPerHour: number | null;
  appointments: number;
  cancelled: number;
  cancellationRate: number | null;
};

const weekdays: { key: Weekday; label: string }[] = [
  { key: "MONDAY", label: "Lunes" },
  { key: "TUESDAY", label: "Martes" },
  { key: "WEDNESDAY", label: "Miércoles" },
  { key: "THURSDAY", label: "Jueves" },
  { key: "FRIDAY", label: "Viernes" },
  { key: "SATURDAY", label: "Sábado" },
  { key: "SUNDAY", label: "Domingo" },
];

function ranked<T extends { count: number; name: string }>(items: T[]) {
  return items.sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "es-AR"),
  );
}

/** HU-29: cálculos puros sobre turnos y cobros ya autorizados por la DAL. */
export function calculateCenterMetrics(
  period: IndicatorPeriod,
  appointments: CenterAppointment[],
  payments: CenterPayment[],
) {
  const professionalMap = new Map<
    number,
    {
      patients: Set<number>;
      workedMinutes: number;
      appointments: number;
      cancelled: number;
    }
  >();
  const patientCounts = new Map<number, number>();
  const serviceCounts = new Map<number, { name: string; count: number }>();
  const specialtyCounts = new Map<number, { name: string; count: number }>();
  const dayCounts = new Map<Weekday, number>();
  let cancelled = 0;

  for (const appointment of appointments) {
    const load = professionalMap.get(appointment.professionalId) ?? {
      patients: new Set<number>(),
      workedMinutes: 0,
      appointments: 0,
      cancelled: 0,
    };
    load.appointments++;
    if (appointment.status === "CANCELLED") {
      load.cancelled++;
      cancelled++;
    }
    if (appointment.status === "COMPLETED") {
      load.patients.add(appointment.patientId);
      load.workedMinutes += Math.max(
        0,
        (appointment.endsAt.getTime() - appointment.startsAt.getTime()) /
          60_000,
      );
      patientCounts.set(
        appointment.patientId,
        (patientCounts.get(appointment.patientId) ?? 0) + 1,
      );
    }
    professionalMap.set(appointment.professionalId, load);

    const service = serviceCounts.get(appointment.serviceId) ?? {
      name: appointment.serviceName,
      count: 0,
    };
    service.count++;
    serviceCounts.set(appointment.serviceId, service);
    if (appointment.specialtyId !== null) {
      const specialty = specialtyCounts.get(appointment.specialtyId) ?? {
        name: appointment.specialtyName ?? "Sin especialidad",
        count: 0,
      };
      specialty.count++;
      specialtyCounts.set(appointment.specialtyId, specialty);
    }
    const day = weekdayOf(toLocalSlot(appointment.startsAt).date);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  const professionals: ProfessionalLoad[] = [...professionalMap].map(
    ([id, load]) => ({
      id,
      distinctPatients: load.patients.size,
      workedMinutes: load.workedMinutes,
      patientsPerHour:
        load.workedMinutes > 0
          ? (load.patients.size * 60) / load.workedMinutes
          : null,
      appointments: load.appointments,
      cancelled: load.cancelled,
      cancellationRate: rate(load.cancelled, load.appointments),
    }),
  );

  const previousFrom = shiftMonthKey(period.from, -periodMonthCount(period));
  const months = new Map<string, number>();
  const methods = new Map<string, number>();
  let totalCents = 0;
  let previousTotalCents = 0;
  for (const payment of payments) {
    const month = monthOf(toLocalSlot(payment.createdAt).date);
    if (month >= period.from && month <= period.to) {
      totalCents += payment.amountCents;
      months.set(month, (months.get(month) ?? 0) + payment.amountCents);
      methods.set(
        payment.methodName,
        (methods.get(payment.methodName) ?? 0) + payment.amountCents,
      );
    } else if (month >= previousFrom && month < period.from) {
      previousTotalCents += payment.amountCents;
    }
  }
  for (
    let month = period.from;
    month <= period.to;
    month = shiftMonthKey(month, 1)
  ) {
    if (!months.has(month)) months.set(month, 0);
  }

  return {
    professionals,
    topProfessionals: [...professionals]
      .filter((item) => item.distinctPatients > 0)
      .sort((a, b) => b.distinctPatients - a.distinctPatients || a.id - b.id)
      .slice(0, 5),
    frequentPatients: [...patientCounts.values()]
      .sort((a, b) => b - a)
      .slice(0, 5),
    services: ranked(
      [...serviceCounts].map(([id, item]) => ({ id, ...item })),
    ).slice(0, 5),
    specialties: ranked(
      [...specialtyCounts].map(([id, item]) => ({ id, ...item })),
    ).slice(0, 5),
    days: weekdays.map(({ key, label }) => ({
      key,
      label,
      count: dayCounts.get(key) ?? 0,
    })),
    cancellationRate: rate(cancelled, appointments.length),
    cancelled,
    appointmentCount: appointments.length,
    income: {
      totalCents,
      previousTotalCents,
      changeRate:
        previousTotalCents > 0
          ? (totalCents - previousTotalCents) / previousTotalCents
          : null,
      months: [...months]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, cents]) => ({ month, cents })),
      methods: [...methods]
        .sort(([a], [b]) => a.localeCompare(b, "es-AR"))
        .map(([name, cents]) => ({ name, cents })),
    },
  };
}
