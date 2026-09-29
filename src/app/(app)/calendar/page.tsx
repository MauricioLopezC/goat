import type { Metadata } from "next";
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
import { DomainError } from "@/lib/actions";
import { requirePageRole } from "@/lib/dal/auth";
import {
  getProfessionalAgenda,
  listAppointments,
  listAvailabilityWindows,
} from "@/lib/dal/appointments";
import { listActiveServices, listProfessionals } from "@/lib/dal/professionals";
import {
  calendarHref,
  calendarRange,
  parseCalendarQuery,
  shiftCalendarDate,
  type CalendarQuery,
} from "@/lib/calendar";
import {
  addDays,
  formatDate,
  formatMonth,
  formatWeekRange,
  getMonthDays,
  toLocalSlot,
} from "@/lib/schedule";
import { WeeklyAgendaGrid } from "../agenda/weekly-agenda-grid";
import { buildCalendarDay } from "./calendar-model";
import { CenterClosureControls } from "./center-closure-controls";
import { CalendarFilters } from "./calendar-filters";
import { DayView } from "./day-view";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";

export const metadata: Metadata = { title: "Calendario · GOAT" };

// Calendario del centro (HU-11). La vista, la fecha y los filtros viven en la
// URL; el profesional usa su agenda (HU-12).
export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const actor = await requirePageRole("RECEPTIONIST", "MANAGER");
  const now = new Date();
  const today = toLocalSlot(now).date;
  const parsed = parseCalendarQuery(await searchParams, today);

  const [professionals, services] = await Promise.all([
    listProfessionals({ status: "active" }, actor),
    listActiveServices(actor),
  ]);
  // Un servicio inexistente o dado de baja en la URL se ignora.
  const query: CalendarQuery = {
    ...parsed,
    serviceId: services.some((service) => service.id === parsed.serviceId)
      ? parsed.serviceId
      : undefined,
  };
  const range = calendarRange(query);
  const filters = {
    ...range,
    professionalId: query.professionalId,
    serviceId: query.serviceId,
  };
  const [appointments, availability] = await Promise.all([
    listAppointments({ ...filters, hideCancelled: query.hideCancelled }, actor),
    listAvailabilityWindows(filters, actor),
  ]);

  // Semana de un solo profesional: la grilla horaria de su agenda (HU-12).
  let agenda: Awaited<ReturnType<typeof getProfessionalAgenda>> | null = null;
  if (query.view === "week" && query.professionalId) {
    try {
      const data = await getProfessionalAgenda(
        {
          date: query.date,
          view: "week",
          hideCancelled: query.hideCancelled,
          professionalId: query.professionalId,
        },
        actor,
      );
      agenda = query.serviceId
        ? {
            ...data,
            appointments: data.appointments.filter(
              (appointment) => appointment.service.id === query.serviceId,
            ),
            windows: data.windows.filter(
              (window) =>
                !window.services.length ||
                window.services.some(
                  (service) => service.id === query.serviceId,
                ),
            ),
          }
        : data;
    } catch (error) {
      if (!(error instanceof DomainError && error.code === "NOT_FOUND"))
        throw error;
    }
  }

  const isMonth = query.view === "month";
  const isWeek = query.view === "week";
  const unit = isMonth ? "Mes" : isWeek ? "Semana" : "Día";

  const monthInfo = isMonth ? getMonthDays(query.date) : null;
  const days = isMonth
    ? monthInfo!.days.map((d) =>
        buildCalendarDay(d.date, availability, appointments, now),
      )
    : Array.from({ length: isWeek ? 7 : 1 }, (_, i) =>
        buildCalendarDay(
          addDays(range.from, i),
          availability,
          appointments,
          now,
        ),
      );
  // Cierre del día que se ve, para quitarlo desde la vista día (HU-14).
  const closure = availability.holidays.find(
    (holiday) => holiday.date === query.date,
  );

  return (
    <div data-layout="wide" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg">Calendario del centro</h1>
          <p className="text-muted-foreground">
            Turnos y bloques libres de todos los profesionales. Horarios de
            Argentina.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isWeek && !isMonth && (
            <CenterClosureControls
              date={query.date}
              holiday={closure ?? null}
              canClose={query.date >= today}
            />
          )}
          <Button asChild>
            <Link href="/appointments/new">Nuevo turno</Link>
          </Button>
        </div>
      </header>

      <div className="bg-card flex flex-col gap-4 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Navegación del calendario"
            className="flex flex-wrap items-center gap-2"
          >
            <Button asChild variant="outline" size="sm">
              <Link
                href={calendarHref({
                  ...query,
                  date: shiftCalendarDate(query, -1),
                })}
              >
                <ChevronLeft data-icon="inline-start" />
                {unit} anterior
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={calendarHref({ ...query, date: today })}>Hoy</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={calendarHref({
                  ...query,
                  date: shiftCalendarDate(query, 1),
                })}
              >
                {unit} siguiente
                <ChevronRight data-icon="inline-end" />
              </Link>
            </Button>
            <h2 className="text-title-lg px-2 first-letter:uppercase">
              {isMonth
                ? formatMonth(query.date)
                : isWeek
                  ? formatWeekRange(range.from, range.to)
                  : formatDate(query.date)}
            </h2>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-muted inline-flex rounded-md border p-0.5">
              <Button asChild size="sm" variant={isMonth ? "default" : "ghost"}>
                <Link
                  href={calendarHref({ ...query, view: "month" })}
                  aria-current={isMonth ? "page" : undefined}
                >
                  <CalendarIcon data-icon="inline-start" />
                  Mes
                </Link>
              </Button>
              <Button asChild size="sm" variant={isWeek ? "default" : "ghost"}>
                <Link
                  href={calendarHref({ ...query, view: "week" })}
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
                  href={calendarHref({ ...query, view: "day" })}
                  aria-current={!isMonth && !isWeek ? "page" : undefined}
                >
                  <CalendarDays data-icon="inline-start" />
                  Día
                </Link>
              </Button>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link
                href={calendarHref({
                  ...query,
                  hideCancelled: !query.hideCancelled,
                })}
              >
                {query.hideCancelled ? (
                  <Eye data-icon="inline-start" />
                ) : (
                  <EyeOff data-icon="inline-start" />
                )}
                {query.hideCancelled
                  ? "Mostrar cancelados"
                  : "Ocultar cancelados"}
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <CalendarFilters
            query={query}
            professionals={professionals}
            services={services}
          />
          <form action="/calendar" className="flex items-end gap-2">
            {query.view !== "day" && (
              <input type="hidden" name="view" value={query.view} />
            )}
            {query.professionalId && (
              <input
                type="hidden"
                name="professionalId"
                value={query.professionalId}
              />
            )}
            {query.serviceId && (
              <input type="hidden" name="serviceId" value={query.serviceId} />
            )}
            {query.hideCancelled && (
              <input type="hidden" name="hideCancelled" value="1" />
            )}
            <Input
              type="date"
              name="date"
              aria-label="Ir a la fecha"
              defaultValue={query.date}
              required
              className="w-44 tabular-nums"
            />
            <Button type="submit" variant="outline">
              Ir a la fecha
            </Button>
          </form>
        </div>
      </div>

      {agenda ? (
        <>
          <p className="text-muted-foreground">
            Semana de {agenda.professional.lastName},{" "}
            {agenda.professional.firstName}. Para dar un turno desde un bloque
            libre, abrí la vista día.
          </p>
          <WeeklyAgendaGrid data={agenda} />
        </>
      ) : isMonth && monthInfo ? (
        <MonthView
          days={days}
          leadingBlankDays={monthInfo.leadingBlankDays}
          trailingBlankDays={monthInfo.trailingBlankDays}
          query={query}
          today={today}
          now={now}
        />
      ) : isWeek ? (
        <WeekView days={days} query={query} today={today} />
      ) : (
        <DayView day={days[0]} query={query} />
      )}
    </div>
  );
}
