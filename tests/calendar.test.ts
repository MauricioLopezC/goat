import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentInstant } from "../src/lib/appointment-slots";
import {
  calculateDaySummary,
  calculateFreeBlocks,
  calendarHref,
  calendarRange,
  parseCalendarQuery,
  pastUntilMinute,
  shiftCalendarDate,
} from "../src/lib/calendar";
import { formatMonth, getMonthDays, weekdayOf } from "../src/lib/schedule";

const date = "2026-10-01";
const base = {
  date,
  windows: [{ startMinute: 540, endMinute: 720 }],
  exceptions: [],
  busy: [],
  holiday: false,
  now: new Date("2026-09-24T12:00:00Z"),
  today: "2026-09-24",
  maxDate: "2026-11-24",
};
const at = (minute: number) => appointmentInstant(date, minute);

test("un día sin turnos ofrece la franja completa", () => {
  assert.deepEqual(calculateFreeBlocks(base), [
    { startMinute: 540, endMinute: 720 },
  ]);
});

test("los turnos que ocupan parten la franja", () => {
  assert.deepEqual(
    calculateFreeBlocks({
      ...base,
      busy: [
        { startsAt: at(600), endsAt: at(630) },
        { startsAt: at(690), endsAt: at(720) },
      ],
    }),
    [
      { startMinute: 540, endMinute: 600 },
      { startMinute: 630, endMinute: 690 },
    ],
  );
});

test("una ausencia parcial se descuenta y una completa elimina el día", () => {
  assert.deepEqual(
    calculateFreeBlocks({
      ...base,
      exceptions: [{ startMinute: 540, endMinute: 600 }],
    }),
    [{ startMinute: 600, endMinute: 720 }],
  );
  assert.deepEqual(
    calculateFreeBlocks({
      ...base,
      exceptions: [{ startMinute: null, endMinute: null }],
    }),
    [],
  );
});

test("feriados, días pasados y fechas fuera del horizonte no ofrecen bloques", () => {
  assert.deepEqual(calculateFreeBlocks({ ...base, holiday: true }), []);
  assert.deepEqual(calculateFreeBlocks({ ...base, date: "2026-09-23" }), []);
  assert.deepEqual(calculateFreeBlocks({ ...base, date: "2026-11-25" }), []);
});

test("hoy se descuenta el tiempo ya transcurrido, alineado al intervalo de grilla (30 min)", () => {
  assert.deepEqual(
    calculateFreeBlocks({
      ...base,
      today: date,
      now: at(602),
    }),
    [{ startMinute: 630, endMinute: 720 }],
  );
});

test("el horario pasado llega hasta donde empiezan los bloques libres", () => {
  assert.equal(pastUntilMinute(date, date, at(602)), 630);
  assert.equal(pastUntilMinute(date, date, at(600)), 600);
  assert.equal(pastUntilMinute(date, "2026-10-02", at(0)), 1440);
  assert.equal(pastUntilMinute(date, "2026-09-30", at(0)), 0);
});

test("los tramos libres menores a 30 minutos no se ofrecen como bloques libres", () => {
  // Hueco de 20 min antes de un turno
  assert.deepEqual(
    calculateFreeBlocks({
      ...base,
      windows: [{ startMinute: 540, endMinute: 600 }],
      busy: [{ startsAt: at(560), endsAt: at(600) }],
    }),
    [],
  );
  // Hoy con corte de tiempo pasado que deja solo 20 min antes del siguiente turno (ej. corte en 600 y turno a las 620)
  assert.deepEqual(
    calculateFreeBlocks({
      ...base,
      today: date,
      now: at(590), // pastUntilMinute redondea a 600 (10:00)
      windows: [{ startMinute: 540, endMinute: 660 }],
      busy: [{ startsAt: at(620), endsAt: at(660) }], // entre 600 y 620 quedan solo 20 min
    }),
    [],
  );
});

test("con servicio, los bloques siguen la grilla del alta de turno", () => {
  assert.deepEqual(
    calculateFreeBlocks({
      ...base,
      windows: [{ startMinute: 540, endMinute: 660 }],
      busy: [{ startsAt: at(560), endsAt: at(580) }],
      durationMinutes: 45,
    }),
    [{ startMinute: 585, endMinute: 630 }],
  );
});

test("la URL del calendario ida y vuelta conserva vista y filtros", () => {
  const query = parseCalendarQuery(
    {
      view: "week",
      date: "2026-10-01",
      professionalId: "3",
      serviceId: "7",
      hideCancelled: "1",
    },
    "2026-09-24",
  );
  assert.deepEqual(query, {
    view: "week",
    date: "2026-10-01",
    professionalId: 3,
    serviceId: 7,
    hideCancelled: true,
  });
  assert.equal(
    calendarHref(query),
    "/calendar?view=week&date=2026-10-01&professionalId=3&serviceId=7&hideCancelled=1",
  );
  const monthQuery = parseCalendarQuery(
    { view: "month", date: "2026-10-15" },
    "2026-09-24",
  );
  assert.equal(monthQuery.view, "month");
  assert.equal(
    calendarHref(monthQuery),
    "/calendar?view=month&date=2026-10-15",
  );
});

test("parámetros inválidos caen en vista día y fecha por defecto", () => {
  assert.deepEqual(
    parseCalendarQuery(
      { view: "other", date: "2026-02-30", professionalId: "-1" },
      "2026-09-24",
    ),
    {
      view: "day",
      date: "2026-09-24",
      professionalId: undefined,
      serviceId: undefined,
      hideCancelled: false,
    },
  );
});

test("rango y navegación de día, semana y mes, cruzando mes y año", () => {
  assert.deepEqual(calendarRange({ view: "day", date: "2026-10-01" }), {
    from: "2026-10-01",
    to: "2026-10-01",
  });
  assert.deepEqual(calendarRange({ view: "week", date: "2026-12-31" }), {
    from: "2026-12-28",
    to: "2027-01-03",
  });
  // Rango de mes fijo: del primer al último día de ese mes
  assert.deepEqual(calendarRange({ view: "month", date: "2026-10-15" }), {
    from: "2026-10-01",
    to: "2026-10-31",
  });
  assert.deepEqual(calendarRange({ view: "month", date: "2026-02-10" }), {
    from: "2026-02-01",
    to: "2026-02-28",
  });

  assert.equal(
    shiftCalendarDate({ view: "week", date: "2026-12-31" }, 1),
    "2027-01-07",
  );
  assert.equal(
    shiftCalendarDate({ view: "day", date: "2026-10-01" }, -1),
    "2026-09-30",
  );
  // Navegación mensual ajustando días y cruzando fin de año
  assert.equal(
    shiftCalendarDate({ view: "month", date: "2026-10-31" }, 1),
    "2026-11-30",
  );
  assert.equal(
    shiftCalendarDate({ view: "month", date: "2026-12-15" }, 1),
    "2027-01-15",
  );
  assert.equal(
    shiftCalendarDate({ view: "month", date: "2026-01-15" }, -1),
    "2025-12-15",
  );

  assert.equal(formatMonth("2026-10-15"), "Octubre - 2026");
  assert.equal(weekdayOf("2026-10-01"), "THURSDAY");
  assert.equal(weekdayOf("2026-10-04"), "SUNDAY");
});

test("getMonthDays genera la grilla con días y espacios de relleno de lunes a domingo", () => {
  const info = getMonthDays("2026-10-15");
  assert.equal(info.from, "2026-10-01");
  assert.equal(info.to, "2026-10-31");
  assert.equal(info.days.length, 31);
  // El 1/10/2026 es jueves -> 3 días previos de relleno (lunes, martes, miércoles)
  assert.equal(info.leadingBlankDays, 3);
  // El 31/10/2026 es sábado -> 1 día posterior de relleno (domingo)
  assert.equal(info.trailingBlankDays, 1);
  // Total de celdas múltiplo de 7 (semanas completas)
  assert.equal(
    (info.leadingBlankDays + info.days.length + info.trailingBlankDays) % 7,
    0,
  );
});

test("calculateDaySummary resume turnos, bloques libres y días cerrados", () => {
  const summaryInput = {
    date: "2026-10-01",
    holiday: null,
    appointments: [
      { startsAt: at(540), status: "SCHEDULED" },
      { startsAt: at(600), status: "COMPLETED" },
      { startsAt: at(660), status: "CANCELLED" },
    ],
    professionals: [
      {
        windows: [{ startMinute: 540, endMinute: 720 }],
        exceptions: [],
        busy: [
          { startsAt: at(540), endsAt: at(570) },
          { startsAt: at(600), endsAt: at(630) },
        ],
      },
    ],
    now: new Date("2026-09-24T12:00:00Z"),
    today: "2026-09-24",
    maxDate: "2026-11-24",
  };

  // Turnos programados y completados contados, bloques libres disponibles
  const result = calculateDaySummary(summaryInput);
  assert.equal(result.scheduledCount, 1);
  assert.equal(result.completedCount, 1);
  assert.equal(result.holiday, null);
  assert.ok(result.freeBlocksCount > 0);

  // Día cerrado por feriado (HU-14): muestra descripción y 0 bloques libres
  const closed = calculateDaySummary({
    ...summaryInput,
    holiday: "Feriado Nacional",
  });
  assert.equal(closed.holiday, "Feriado Nacional");
  assert.equal(closed.freeBlocksCount, 0);

  // Día pasado: muestra turnos pero 0 bloques libres (HU-11 / HU-15)
  const past = calculateDaySummary({
    ...summaryInput,
    date: "2026-09-20",
    appointments: [{ startsAt: "2026-09-20T10:00:00Z", status: "SCHEDULED" }],
  });
  assert.equal(past.scheduledCount, 1);
  assert.equal(past.freeBlocksCount, 0);

  // Día fuera del horizonte de 2 meses: 0 bloques libres
  const outside = calculateDaySummary({
    ...summaryInput,
    date: "2026-12-01",
  });
  assert.equal(outside.freeBlocksCount, 0);
});
