import Link from "next/link";
import {
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
  formatWeekRange,
  toLocalSlot,
} from "@/lib/schedule";
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
  const isWeek = data.view === "week";
  const todayDate = toLocalSlot(new Date()).date;

  const prevDate = isWeek ? addDays(data.date, -7) : addDays(data.date, -1);
  const nextDate = isWeek ? addDays(data.date, 7) : addDays(data.date, 1);

  const buildUrl = (
    newDate: string,
    newView: "week" | "day",
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

  return (
    <div className="flex flex-col gap-6">
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
                {data.summary.total === 1 ? "turno" : "turnos"} en esta{" "}
                {isWeek ? "semana" : "jornada"}:
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
          <div className="flex items-center gap-2">
            {professionals && professionals.length > 0 && (
              <AgendaProfessionalSwitcher
                currentProfessionalId={data.professional.id}
                professionals={professionals}
                date={data.date}
                view={data.view}
                hideCancelled={data.hideCancelled}
              />
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/professionals/${data.professional.id}`}>
                Volver a la ficha
              </Link>
            </Button>
          </div>
        )}
      </header>

      {/* Barra de navegación temporal y controles */}
      <div className="bg-card border-border flex flex-wrap items-center justify-between gap-4 rounded-xl border p-3 shadow-2xs">
        {/* Navegación Anterior / Hoy / Siguiente */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="sm">
              <Link
                href={buildUrl(prevDate, data.view)}
                title={isWeek ? "Semana anterior" : "Día anterior"}
              >
                <ChevronLeft className="size-4" />
                <span className="hidden sm:inline">
                  {isWeek ? "Semana anterior" : "Día anterior"}
                </span>
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href={buildUrl(todayDate, data.view)}>Hoy</Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link
                href={buildUrl(nextDate, data.view)}
                title={isWeek ? "Semana siguiente" : "Día siguiente"}
              >
                <span className="hidden sm:inline">
                  {isWeek ? "Semana siguiente" : "Día siguiente"}
                </span>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>

          <span className="text-body-sm font-semibold capitalize px-2">
            {isWeek
              ? formatWeekRange(data.week.monday, data.week.sunday)
              : formatDate(data.date)}
          </span>
        </div>

        {/* Controles de vista, filtro y selector de fecha */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de fecha directo (con w-44 para no colapsar) */}
          <form
            action="/agenda"
            method="GET"
            className="flex items-center gap-2"
          >
            {isStaff && (
              <input
                type="hidden"
                name="professionalId"
                value={data.professional.id}
              />
            )}
            <input type="hidden" name="view" value={data.view} />
            {data.hideCancelled && (
              <input type="hidden" name="hideCancelled" value="1" />
            )}
            <Input
              type="date"
              name="date"
              defaultValue={data.date}
              className="w-44 tabular-nums"
              required
            />
            <Button type="submit" variant="outline" size="sm">
              Ver fecha
            </Button>
          </form>

          {/* Toggle de vista: Semana vs Día */}
          <div className="bg-muted inline-flex rounded-lg p-0.5 border border-border">
            <Button
              asChild
              variant={isWeek ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
            >
              <Link href={buildUrl(data.date, "week")}>
                <CalendarRange className="size-3.5 mr-1.5" />
                Semana
              </Link>
            </Button>
            <Button
              asChild
              variant={!isWeek ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
            >
              <Link href={buildUrl(data.date, "day")}>
                <CalendarDays className="size-3.5 mr-1.5" />
                Día
              </Link>
            </Button>
          </div>

          {/* Toggle Ocultar / Mostrar cancelados */}
          {data.hideCancelled ? (
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link href={buildUrl(data.date, data.view, false)}>
                <Eye className="size-3.5 mr-1.5" />
                Mostrar cancelados
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link href={buildUrl(data.date, data.view, true)}>
                <EyeOff className="size-3.5 mr-1.5" />
                Ocultar cancelados
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Contenido principal según vista elegida */}
      {isWeek ? (
        <WeeklyAgendaGrid data={data} />
      ) : (
        <DailyAgendaList data={data} />
      )}
    </div>
  );
}
