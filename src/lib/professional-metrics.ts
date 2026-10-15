import type { AppointmentStatus, Gender } from "@/generated/prisma/enums";
import { rate, type IndicatorPeriod } from "@/lib/indicators";
import { GENDER_LABEL } from "@/lib/patients";

export type ProfessionalAppointmentMetric = {
  id: number;
  patientId: number;
  serviceId: number;
  serviceName: string;
  startsAt: Date;
  status: AppointmentStatus;
};

export type PatientMetricData = {
  id: number;
  gender: Gender;
  birthDate: Date;
};

export type ServiceMetricItem = {
  serviceId: number;
  serviceName: string;
  count: number;
  percentage: number | null;
};

export type GenderDistribution = {
  gender: Gender;
  label: string;
  count: number;
  percentage: number | null;
};

export type AgeRangeKey =
  "UNDER_18" | "FROM_18_TO_39" | "FROM_40_TO_64" | "FROM_65_AND_OVER";

export type AgeDistribution = {
  range: AgeRangeKey;
  label: string;
  count: number;
  percentage: number | null;
};

export const AGE_RANGES: { key: AgeRangeKey; label: string }[] = [
  { key: "UNDER_18", label: "Menores de 18 años" },
  { key: "FROM_18_TO_39", label: "18 a 39 años" },
  { key: "FROM_40_TO_64", label: "40 a 64 años" },
  { key: "FROM_65_AND_OVER", label: "65 años o más" },
];

/// Calcula la edad en años cumplidos a la fecha especificada (en UTC seguro).
export function calculateAgeAt(
  birthDate: Date | string,
  atDate: Date | string,
): number {
  const birth = new Date(birthDate);
  const at = new Date(atDate);
  if (isNaN(birth.getTime()) || isNaN(at.getTime())) return 0;
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return Math.max(0, age);
}

/// Clasifica una edad en los 4 rangos de la HU-30.
export function classifyAgeRange(age: number): AgeRangeKey {
  if (age < 18) return "UNDER_18";
  if (age <= 39) return "FROM_18_TO_39";
  if (age <= 64) return "FROM_40_TO_64";
  return "FROM_65_AND_OVER";
}

export type ProfessionalMetrics = {
  period: IndicatorPeriod;
  // Turnos totales y desglose por estado
  totalAppointments: number;
  completedAppointments: number;
  completedRate: number | null;
  expiredAppointments: number;
  expiredRate: number | null;
  cancelledAppointments: number;
  cancelledRate: number | null;

  // Turnos por servicio
  services: ServiceMetricItem[];

  // Pacientes atendidos y nuevos
  distinctPatientsCount: number;
  newPatientsCount: number;
  newPatientsRate: number | null;

  // Distribución de pacientes atendidos por sexo
  genderDistribution: GenderDistribution[];

  // Distribución de pacientes atendidos por rango de edad
  ageDistribution: AgeDistribution[];
};

/**
 * HU-30: Cálculo puro de métricas del profesional en el período.
 *
 * @param period Período seleccionado.
 * @param appointments Turnos del profesional en el período.
 * @param patients Datos de los pacientes que tuvieron al menos un turno completado en el período.
 * @param priorPatientIds Set con los IDs de pacientes que YA tenían turnos completados con este
 *                         profesional antes del período (para saber quiénes son nuevos).
 */
export function calculateProfessionalMetrics(
  period: IndicatorPeriod,
  appointments: ProfessionalAppointmentMetric[],
  patients: PatientMetricData[],
  priorPatientIds: ReadonlySet<number>,
): ProfessionalMetrics {
  let completed = 0;
  let expired = 0;
  let cancelled = 0;

  const serviceMap = new Map<number, { name: string; count: number }>();

  // Primer turno completado de cada paciente en el período para cálculo de edad
  const patientFirstCompletedMap = new Map<number, Date>();

  for (const appointment of appointments) {
    switch (appointment.status) {
      case "COMPLETED":
        completed++;
        if (
          !patientFirstCompletedMap.has(appointment.patientId) ||
          appointment.startsAt <
            (patientFirstCompletedMap.get(appointment.patientId) as Date)
        ) {
          patientFirstCompletedMap.set(
            appointment.patientId,
            appointment.startsAt,
          );
        }
        break;
      case "EXPIRED":
        expired++;
        break;
      case "CANCELLED":
        cancelled++;
        break;
    }

    const currentService = serviceMap.get(appointment.serviceId) ?? {
      name: appointment.serviceName,
      count: 0,
    };
    currentService.count++;
    serviceMap.set(appointment.serviceId, currentService);
  }

  const totalAppointments = appointments.length;

  // Servicios ordenados por cantidad descendente, y alfabéticamente ante empates
  const services: ServiceMetricItem[] = Array.from(serviceMap.entries())
    .map(([serviceId, { name, count }]) => ({
      serviceId,
      serviceName: name,
      count,
      percentage: rate(count, totalAppointments),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.serviceName.localeCompare(b.serviceName, "es-AR"),
    );

  // Pacientes atendidos (con al menos un turno completado en el período)
  const patientMap = new Map<number, PatientMetricData>(
    patients.map((p) => [p.id, p]),
  );

  const attendedPatientIds = Array.from(patientFirstCompletedMap.keys());
  const distinctPatientsCount = attendedPatientIds.length;

  let newPatientsCount = 0;
  for (const patientId of attendedPatientIds) {
    if (!priorPatientIds.has(patientId)) {
      newPatientsCount++;
    }
  }

  // Distribución por sexo
  const genderCounts: Record<Gender, number> = {
    FEMALE: 0,
    MALE: 0,
    OTHER: 0,
  };

  // Distribución por edad
  const ageCounts: Record<AgeRangeKey, number> = {
    UNDER_18: 0,
    FROM_18_TO_39: 0,
    FROM_40_TO_64: 0,
    FROM_65_AND_OVER: 0,
  };

  for (const patientId of attendedPatientIds) {
    const patient = patientMap.get(patientId);
    if (!patient) continue;

    genderCounts[patient.gender] = (genderCounts[patient.gender] ?? 0) + 1;

    const appointmentDate =
      patientFirstCompletedMap.get(patientId) ?? new Date();
    const age = calculateAgeAt(patient.birthDate, appointmentDate);
    const range = classifyAgeRange(age);
    ageCounts[range] = (ageCounts[range] ?? 0) + 1;
  }

  const genderDistribution: GenderDistribution[] = [
    {
      gender: "FEMALE",
      label: GENDER_LABEL.FEMALE,
      count: genderCounts.FEMALE,
      percentage: rate(genderCounts.FEMALE, distinctPatientsCount),
    },
    {
      gender: "MALE",
      label: GENDER_LABEL.MALE,
      count: genderCounts.MALE,
      percentage: rate(genderCounts.MALE, distinctPatientsCount),
    },
    {
      gender: "OTHER",
      label: GENDER_LABEL.OTHER,
      count: genderCounts.OTHER,
      percentage: rate(genderCounts.OTHER, distinctPatientsCount),
    },
  ];

  const ageDistribution: AgeDistribution[] = AGE_RANGES.map(
    ({ key, label }) => ({
      range: key,
      label,
      count: ageCounts[key],
      percentage: rate(ageCounts[key], distinctPatientsCount),
    }),
  );

  return {
    period,
    totalAppointments,
    completedAppointments: completed,
    completedRate: rate(completed, totalAppointments),
    expiredAppointments: expired,
    expiredRate: rate(expired, totalAppointments),
    cancelledAppointments: cancelled,
    cancelledRate: rate(cancelled, totalAppointments),

    services,

    distinctPatientsCount,
    newPatientsCount,
    newPatientsRate: rate(newPatientsCount, distinctPatientsCount),

    genderDistribution,
    ageDistribution,
  };
}
