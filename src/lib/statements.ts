import { Prisma } from "@/generated/prisma/client";
import { isCalendarDate, toLocalSlot } from "@/lib/schedule";

// Rendición por profesional (HU-28).
// La comisión del centro es un valor fijo configurado (15 %) sobre lo cobrado
// a pacientes particulares por el uso de las instalaciones.

export const CENTER_COMMISSION_PERCENTAGE = 15;
export const CENTER_COMMISSION_RATE = 0.15;
export const MAX_STATEMENT_RANGE_DAYS = 93;

export type StatementCommission = {
  commission: string;
  net: string;
};

/**
 * Calcula la comisión del centro (15 %) y el neto para el profesional,
 * redondeando la comisión al centavo con dos decimales.
 */
export function calculateCommission(
  amount: number | string | Prisma.Decimal,
): StatementCommission {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? Number(amount)
        : Number(amount.toFixed(2));

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { commission: "0.00", net: "0.00" };
  }

  // Redondeo al centavo: 15% de lo cobrado
  const commissionCents = Math.round(numericAmount * 15);
  const commissionNum = commissionCents / 100;
  const netNum = Math.max(0, numericAmount - commissionNum);

  return {
    commission: commissionNum.toFixed(2),
    net: netNum.toFixed(2),
  };
}

/**
 * Devuelve el período por defecto: el mes en curso completo (del primer al último día)
 * en la zona horaria de Salta / Buenos Aires.
 */
export function defaultStatementPeriod(now = new Date()): {
  from: string;
  to: string;
} {
  const localDate = toLocalSlot(now).date;
  const [yearStr, monthStr] = localDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const from = `${yearStr}-${monthStr}-01`;
  // El día 0 del mes siguiente da el último día del mes actual en UTC
  const lastDayDate = new Date(Date.UTC(year, month, 0));
  const to = lastDayDate.toISOString().slice(0, 10);

  return { from, to };
}

/**
 * Comprueba si un rango de fechas [from, to] corresponde a un mes calendario completo.
 */
export function isFullMonth(from: string, to: string): boolean {
  if (!isCalendarDate(from) || !isCalendarDate(to)) return false;
  if (!from.endsWith("-01")) return false;
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const lastDay = new Date(Date.UTC(fromYear, fromMonth, 0))
    .toISOString()
    .slice(0, 10);
  return to === lastDay;
}

const monthNameFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const shortDateFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Formato legible para el período de la rendición.
 * Ejemplos: "Octubre de 2026", "01/10/2026 al 15/10/2026".
 */
export function formatStatementPeriod(from: string, to: string): string {
  if (isFullMonth(from, to)) {
    const formatted = monthNameFormat.format(new Date(`${from}T00:00:00.000Z`));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  const fromFormatted = shortDateFormat.format(
    new Date(`${from}T00:00:00.000Z`),
  );
  const toFormatted = shortDateFormat.format(new Date(`${to}T00:00:00.000Z`));
  return `${fromFormatted} al ${toFormatted}`;
}

/**
 * Calcula la cantidad de días transcurridos entre dos fechas inclusive.
 */
export function countDaysInclusive(from: string, to: string): number {
  const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${to}T00:00:00.000Z`).getTime();
  const diffMs = toTime - fromTime;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}
