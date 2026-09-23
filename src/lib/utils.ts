export { cn } from "cn";

/**
 * Devuelve la fecha actual en formato ISO (YYYY-MM-DD) para la zona horaria indicada
 * (por defecto 'America/Argentina/Buenos_Aires').
 */
export function getTodayDateString(
  timeZone = "America/Argentina/Buenos_Aires",
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
