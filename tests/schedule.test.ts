import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, formatWeekRange, getWeekDays } from "../src/lib/schedule";

test("getWeekDays calcula correctamente los 7 días de la semana de lunes a domingo", () => {
  // Miércoles 23 de septiembre de 2026
  const week = getWeekDays("2026-09-23");
  assert.equal(week.monday, "2026-09-21");
  assert.equal(week.sunday, "2026-09-27");
  assert.equal(week.days.length, 7);
  assert.equal(week.days[0].weekday, "MONDAY");
  assert.equal(week.days[0].date, "2026-09-21");
  assert.equal(week.days[6].weekday, "SUNDAY");
  assert.equal(week.days[6].date, "2026-09-27");

  // Domingo 4 de octubre de 2026 (debe pertenecer a la semana que empezó el lunes 28 de sep)
  const sundayWeek = getWeekDays("2026-10-04");
  assert.equal(sundayWeek.monday, "2026-09-28");
  assert.equal(sundayWeek.sunday, "2026-10-04");

  // Lunes 28 de septiembre de 2026
  const mondayWeek = getWeekDays("2026-09-28");
  assert.equal(mondayWeek.monday, "2026-09-28");
  assert.equal(mondayWeek.sunday, "2026-10-04");
});

test("addDays suma y resta días respetando cambios de mes y año", () => {
  assert.equal(addDays("2026-09-28", 7), "2026-10-05");
  assert.equal(addDays("2026-09-28", -7), "2026-09-21");
  assert.equal(addDays("2026-10-01", -1), "2026-09-30");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("formatWeekRange formatea el rango semanal legiblemente", () => {
  assert.match(
    formatWeekRange("2026-09-21", "2026-09-27"),
    /21 al 27 de sep.* de 2026/,
  );
  assert.match(
    formatWeekRange("2026-09-28", "2026-10-04"),
    /28 de sep.* – 4 de oct.* de 2026/,
  );
});
