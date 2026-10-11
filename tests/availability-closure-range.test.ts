import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appointmentInstant,
  calculateAvailableSlots,
} from "../src/lib/appointment-slots";
import { calculateFreeBlocks } from "../src/lib/calendar";
import {
  calculateIndicators,
  periodDays,
  type ProfessionalIndicatorsInput,
} from "../src/lib/indicators";
import {
  createAvailabilityExceptionSchema,
  createHolidaySchema,
} from "../src/lib/validation/availability";

test("createHolidaySchema: valida rangos de fechas de cierre", () => {
  // Cierre de día completo en un solo día
  const single = createHolidaySchema.safeParse({
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    allDay: true,
    description: "Feriado local",
  });
  assert.equal(single.success, true);
  if (single.success) {
    assert.equal(single.data.startDate, "2026-10-15");
    assert.equal(single.data.endDate, "2026-10-15");
    assert.equal(single.data.startMinute, null);
    assert.equal(single.data.endMinute, null);
  }

  // Cierre de varios días completos
  const multiDay = createHolidaySchema.safeParse({
    startDate: "2026-10-15",
    endDate: "2026-10-18",
    allDay: true,
    description: "Reformas en el centro",
  });
  assert.equal(multiDay.success, true);
  if (multiDay.success) {
    assert.equal(multiDay.data.startDate, "2026-10-15");
    assert.equal(multiDay.data.endDate, "2026-10-18");
  }

  // Cierre por horas
  const partial = createHolidaySchema.safeParse({
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    allDay: false,
    startTime: "13:00",
    endTime: "16:00",
    description: "Desinfección",
  });
  assert.equal(partial.success, true);
  if (partial.success) {
    assert.equal(partial.data.startMinute, 780);
    assert.equal(partial.data.endMinute, 960);
  }

  // Rechaza fecha invertida
  const inverted = createHolidaySchema.safeParse({
    startDate: "2026-10-20",
    endDate: "2026-10-15",
    allDay: true,
    description: "Invalido",
  });
  assert.equal(inverted.success, false);

  // Rechaza horarios invertidos o iguales cuando no es todo el día
  const invertedTime = createHolidaySchema.safeParse({
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    allDay: false,
    startTime: "16:00",
    endTime: "13:00",
    description: "Invalido",
  });
  assert.equal(invertedTime.success, false);

  const equalTime = createHolidaySchema.safeParse({
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    allDay: false,
    startTime: "13:00",
    endTime: "13:00",
    description: "Invalido",
  });
  assert.equal(equalTime.success, false);

  // Compatibilidad hacia atrás: soporta campo 'date'
  const legacy = createHolidaySchema.safeParse({
    date: "2026-10-15",
    allDay: true,
    description: "Compatibilidad",
  });
  assert.equal(legacy.success, true);
  if (legacy.success) {
    assert.equal(legacy.data.startDate, "2026-10-15");
    assert.equal(legacy.data.endDate, "2026-10-15");
  }
});

test("createAvailabilityExceptionSchema: valida rangos de ausencias del profesional", () => {
  const validRange = createAvailabilityExceptionSchema.safeParse({
    professionalId: 1,
    startDate: "2026-10-15",
    endDate: "2026-10-20",
    allDay: true,
    reason: "Vacaciones",
  });
  assert.equal(validRange.success, true);
  if (validRange.success) {
    assert.equal(validRange.data.startDate, "2026-10-15");
    assert.equal(validRange.data.endDate, "2026-10-20");
    assert.equal(validRange.data.startMinute, null);
    assert.equal(validRange.data.endMinute, null);
  }

  const validPartial = createAvailabilityExceptionSchema.safeParse({
    professionalId: 1,
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    allDay: false,
    startTime: "09:00",
    endTime: "11:00",
    reason: "Trámite bancario",
  });
  assert.equal(validPartial.success, true);
  if (validPartial.success) {
    assert.equal(validPartial.data.startMinute, 540);
    assert.equal(validPartial.data.endMinute, 660);
  }

  // Rechaza fecha invertida
  const inverted = createAvailabilityExceptionSchema.safeParse({
    professionalId: 1,
    startDate: "2026-10-25",
    endDate: "2026-10-20",
    allDay: true,
    reason: "Error",
  });
  assert.equal(inverted.success, false);
});

test("calculateAvailableSlots: descuenta cierres parciales del centro por horas", () => {
  const base = {
    date: "2026-10-01",
    durationMinutes: 30,
    windows: [{ startMinute: 540, endMinute: 720 }], // 09:00 a 12:00
    exceptions: [],
    appointments: [],
    holiday: false,
    now: new Date("2026-09-23T12:00:00Z"),
  };

  // Cierre parcial del centro de 10:00 a 11:00 (600 a 660)
  const slotsWithPartialHoliday = calculateAvailableSlots({
    ...base,
    holidays: [{ startMinute: 600, endMinute: 660 }],
  });
  assert.deepEqual(
    slotsWithPartialHoliday.map((s) => s.startTime),
    ["09:00", "09:30", "11:00", "11:30"],
  );

  // Cierre de día completo mediante array holidays elimina todo
  const slotsWithFullHoliday = calculateAvailableSlots({
    ...base,
    holidays: [{ startMinute: null, endMinute: null }],
  });
  assert.deepEqual(slotsWithFullHoliday, []);

  // Cierre parcial junto con turno ocupado
  const slotsWithPartialAndAppt = calculateAvailableSlots({
    ...base,
    holidays: [{ startMinute: 600, endMinute: 660 }], // 10:00 a 11:00
    appointments: [
      {
        startsAt: appointmentInstant(base.date, 540), // 09:00 a 09:30 ocupado
        endsAt: appointmentInstant(base.date, 570),
      },
    ],
  });
  assert.deepEqual(
    slotsWithPartialAndAppt.map((s) => s.startTime),
    ["09:30", "11:00", "11:30"],
  );
});

test("calculateFreeBlocks: descuenta cierres parciales del centro en calendario", () => {
  const base = {
    date: "2026-10-01",
    windows: [{ startMinute: 540, endMinute: 720 }], // 09:00 a 12:00
    exceptions: [],
    busy: [],
    holiday: false,
    now: new Date("2026-09-24T12:00:00Z"),
    today: "2026-09-24",
    maxDate: "2026-11-24",
  };

  // Cierre parcial del centro de 10:00 a 11:00 (600 a 660)
  const blocks = calculateFreeBlocks({
    ...base,
    holidays: [{ startMinute: 600, endMinute: 660 }],
  });
  assert.deepEqual(blocks, [
    { startMinute: 540, endMinute: 600 },
    { startMinute: 660, endMinute: 720 },
  ]);

  // Cierre completo mediante holidays elimina todo
  const fullBlocks = calculateFreeBlocks({
    ...base,
    holidays: [{ startMinute: null, endMinute: null }],
  });
  assert.deepEqual(fullBlocks, []);
});

test("indicators: descuenta cierres parciales y por rango en minutos disponibles", () => {
  const now = new Date("2026-10-20T15:00:00Z");
  // Período de 1 día (el jueves 2026-10-01). Franja de 09:00 a 12:00 = 180 min.
  const baseInput: ProfessionalIndicatorsInput = {
    days: ["2026-10-01"],
    holidays: new Set(),
    holidayRanges: [],
    windows: [{ weekday: "THURSDAY", startMinute: 540, endMinute: 720 }],
    exceptions: [],
    deactivatedOn: null,
    appointments: [],
    now,
  };

  // Sin cierres: 180 minutos disponibles
  const resultBase = calculateIndicators(baseInput);
  assert.equal(resultBase.availableMinutes, 180);

  // Con cierre parcial de 1 hora (60 min) de 10:00 a 11:00
  const resultPartial = calculateIndicators({
    ...baseInput,
    holidayRanges: [{ date: "2026-10-01", startMinute: 600, endMinute: 660 }],
  });
  assert.equal(resultPartial.availableMinutes, 120);

  // Con cierre de día completo en Set holidays: 0 minutos
  const resultFull = calculateIndicators({
    ...baseInput,
    holidays: new Set(["2026-10-01"]),
  });
  assert.equal(resultFull.availableMinutes, 0);
});
