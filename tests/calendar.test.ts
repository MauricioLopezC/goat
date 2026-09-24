import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentInstant } from "../src/lib/appointment-slots";
import {
  calculateFreeBlocks,
  calendarHref,
  calendarRange,
  parseCalendarQuery,
  shiftCalendarDate,
} from "../src/lib/calendar";
import { weekdayOf } from "../src/lib/schedule";

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

test("hoy se descuenta el tiempo ya transcurrido, redondeado a 5 minutos", () => {
  assert.deepEqual(
    calculateFreeBlocks({
      ...base,
      today: date,
      now: at(602),
    }),
    [{ startMinute: 605, endMinute: 720 }],
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
});

test("parámetros inválidos caen en vista día y fecha por defecto", () => {
  assert.deepEqual(
    parseCalendarQuery(
      { view: "month", date: "2026-02-30", professionalId: "-1" },
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

test("rango y navegación de día y semana, cruzando mes y año", () => {
  assert.deepEqual(calendarRange({ view: "day", date: "2026-10-01" }), {
    from: "2026-10-01",
    to: "2026-10-01",
  });
  assert.deepEqual(calendarRange({ view: "week", date: "2026-12-31" }), {
    from: "2026-12-28",
    to: "2027-01-03",
  });
  assert.equal(
    shiftCalendarDate({ view: "week", date: "2026-12-31" }, 1),
    "2027-01-07",
  );
  assert.equal(
    shiftCalendarDate({ view: "day", date: "2026-10-01" }, -1),
    "2026-09-30",
  );
  assert.equal(weekdayOf("2026-10-01"), "THURSDAY");
  assert.equal(weekdayOf("2026-10-04"), "SUNDAY");
});
