import Link from "next/link";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDays,
  formatDate,
  formatMonth,
  formatWeekRange,
  getMonthDays,
  shiftMonth,
  toLocalSlot,
} from "@/lib/schedule";
import { appointmentDateBounds } from "@/lib/appointment-slots";
import { calculateFreeBlocks } from "@/lib/calendar";
import { MonthGrid, type MonthGridDay } from "../calendar/month-view";
import { Legend } from "../calendar/day-view";
import type { AgendaData } from "./agenda-types";
import {
  AgendaProfessionalSwitcher,
  type ProfessionalSummaryItem,
} from "./agenda-professional-switcher";
import { DailyAgendaList } from "./daily-agenda-list";
import { WeeklyAgendaGrid } from "./weekly-agenda-grid";

export function AgendaView({
  data,
  professionals,
  isStaff,
}: {
  data: AgendaData;
  professionals?: ProfessionalSummaryItem[];
  isStaff?: boolean;
}) {
  const isMonth = data.view === "month";
  const isWeek = data.view === "week";
  const unit = isMonth ? "Mes" : isWeek ? "Semana" : "Día";
  const todayDate = toLocalSlot(new Date()).date;

  const prevDate = isMonth
    ? shiftMonth(data.date, -1)
    : isWeek
      ? addDays(data.date, -7)
      : addDays(data.date, -1);
  const nextDate = isMonth
    ? shiftMonth(data.date, 1)
    : isWeek
      ? addDays(data.date, 7)
      : addDays(data.date, 1);

  const buildUrl = (
    newDate: string,
    newView: "month" | "week" | "day",
    hide?: boolean,
  ) => {
    const params = new URLSearchParams();
    if (isStaff) {
      params.set("professionalId", String(data.professional.id));
    }
    params.set("date", newDate);
    if (newView !== "week") params.set("view", newView);
    if (hide ?? data.hideCancelled) params.set("hideCancelled", "1");
    return `/agenda?${params.toString()}`;
  };

  const monthInfo = isMonth ? getMonthDays(data.date) : null;
  const now = new Date();
  const bounds = appointmentDateBounds(now);

  const monthGridDays: MonthGridDay[] = monthInfo
    ? monthInfo.days.map((d) => {
        const holiday =
          data.holidays.find((h) => h.date === d.date)?.description ?? null;
        const dayAppointments = data.appointments.filter(
          (a) => toLocalSlot(a.startsAt).date === d.date,
        );
        const scheduledCount = dayAppointments.filter(
          (a) => a.status === "SCHEDULED",
        ).length;
        const completedCount = dayAppointments.filter(
          (a) => a.status === "COMPLETED",
        ).length;

        const dayWindows = data.windows
          .filter((w) => w.weekday === d.weekday)
          .map((w) => ({
            startMinute: w.startMinute,
            endMinute: w.endMinute,
          }));

        const dayExceptions = data.exceptions.filter((e) => e.date === d.date);

        const busyAppointments = dayAppointments.filter(
          (a) => a.status === "SCHEDULED" || a.status === "COMPLETED",
        );

        const freeBlocks = calculateFreeBlocks({
          date: d.date,
          windows: dayWindows,
          exceptions: dayExceptions,
          busy: busyAppointments,
          holiday: Boolean(holiday),
          now,
          today: todayDate,
          maxDate: bounds.max,
        });

        return {
          date: d.date,
          dayNumber: d.dayNumber,
          weekday: d.weekday,
          isToday: d.date === todayDate,
          isPast: d.date < todayDate,
          isOutsideHorizon: d.date > bounds.max,
          holiday,
          scheduledCount,
          completedCount,
          freeBlocksCount: freeBlocks.length,
          href: buildUrl(d.date, "day"),
        };
      })
    : [];

  return (
    <div data-layout="wide" className="flex flex-col gap-6">
      {/* Encabezado principal */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg font-bold">
            {isStaff ? "Agenda del profesional" : "Mi agenda"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.professional.titles
              ? `${data.professional.titles} `
              : "Profesional "}
            {data.professional.lastName}, {data.professional.firstName} ·
            Horarios de Argentina.
          </p>
          {data.summary.total > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="font-medium text-foreground">
                {data.summary.total}{" "}
                {data.summary.total === 1 ? "turno" : "turnos"} en{" "}
                {isMonth ? "este mes" : isWeek ? "esta semana" : "esta jornada"}
                :
              </span>
              <span className="text-primary font-medium">
                {data.summary.scheduled}{" "}
                {data.summary.scheduled === 1 ? "programado" : "programados"}
              </span>
              {data.summary.completed > 0 && (
                <>
                  <span>·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {data.summary.completed}{" "}
                    {data.summary.completed === 1
                      ? "completado"
                      : "completados"}
                  </span>
                </>
              )}
              {data.summary.cancelled > 0 && (
                <>
                  <span>·</span>
                  <span className="text-destructive font-medium">
                    {data.summary.cancelled}{" "}
                    {data.summary.cancelled === 1 ? "cancelado" : "cancelados"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        {isStaff && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/professionals/${data.professional.id}`}>
              Volver a la ficha
            </Link>
          </Button>
        )}
      </header>

      {/* Barra de navegación temporal y controles */}
      <div className="bg-card flex flex-col gap-4 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Navegación de la agenda"
            className="flex flex-wrap items-center gap-2"
          >
            <Button asChild variant="outline" size="sm">
              <Link
                href={buildUrl(prevDate, data.view)}
                aria-label={`${unit} anterior`}
              >
                <ChevronLeft data-icon="inline-start" />
                {unit} anterior
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={buildUrl(todayDate, data.view)}>Hoy</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={buildUrl(nextDate, data.view)}
                aria-label={`${unit} siguiente`}
              >
                {unit} siguiente
                <ChevronRight data-icon="inline-end" />
              </Link>
            </Button>
            <h2 className="text-title-lg px-2 first-letter:uppercase">
              {isMonth
                ? formatMonth(data.date)
                : isWeek
                  ? formatWeekRange(data.week.monday, data.week.sunday)
                  : formatDate(data.date)}
            </h2>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-muted inline-flex rounded-md border p-0.5">
              <Button asChild size="sm" variant={isMonth ? "default" : "ghost"}>
                <Link
                  href={buildUrl(data.date, "month")}
                  aria-current={isMonth ? "page" : undefined}
                >
                  <CalendarIcon data-icon="inline-start" />
                  Mes
                </Link>
              </Button>
              <Button asChild size="sm" variant={isWeek ? "default" : "ghost"}>
                <Link
                  href={buildUrl(data.date, "week")}
                  aria-current={isWeek ? "page" : undefined}
                >
                  <CalendarRange data-icon="inline-start" />
                  Semana
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={!isMonth && !isWeek ? "default" : "ghost"}
              >
                <Link
                  href={buildUrl(data.date, "day")}
                  aria-current={!isMonth && !isWeek ? "page" : undefined}
                >
                  <CalendarDays data-icon="inline-start" />
                  Día
                </Link>
              </Button>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={buildUrl(data.date, data.view, !data.hideCancelled)}>
                {data.hideCancelled ? (
                  <Eye data-icon="inline-start" />
                ) : (
                  <EyeOff data-icon="inline-start" />
                )}
                {data.hideCancelled
                  ? "Mostrar cancelados"
                  : "Ocultar cancelados"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            {isStaff && professionals && professionals.length > 0 && (
              <AgendaProfessionalSwitcher
                currentProfessionalId={data.professional.id}
                professionals={professionals}
                date={data.date}
                view={data.view}
                hideCancelled={data.hideCancelled}
              />
            )}
          </div>
          <form action="/agenda" method="GET" className="flex items-end gap-2">
            {isStaff && (
              <input
                type="hidden"
                name="professionalId"
                value={data.professional.id}
              />
            )}
            {data.view !== "week" && (
              <input type="hidden" name="view" value={data.view} />
            )}
            {data.hideCancelled && (
              <input type="hidden" name="hideCancelled" value="1" />
            )}
            <Input
              type="date"
              name="date"
              aria-label="Ir a la fecha"
              defaultValue={data.date}
              required
              className="w-44 tabular-nums"
            />
            <Button type="submit" variant="outline">
              Ir a la fecha
            </Button>
          </form>
        </div>
      </div>

      {/* Contenido principal según vista elegida */}
      {isMonth && monthInfo ? (
        <div className="flex flex-col gap-4">
          <MonthGrid
            days={monthGridDays}
            leadingBlankDays={monthInfo.leadingBlankDays}
            trailingBlankDays={monthInfo.trailingBlankDays}
          />
          <Legend freeClickable={false} />
        </div>
      ) : isWeek ? (
        <WeeklyAgendaGrid data={data} />
      ) : (
        <DailyAgendaList data={data} />
      )}
    </div>
  );
}
