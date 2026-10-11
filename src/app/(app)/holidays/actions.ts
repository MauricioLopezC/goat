"use server";

import { revalidatePath } from "next/cache";
import * as dal from "@/lib/dal/availability";
import {
  createHolidaySchema,
  deleteHolidaySchema,
} from "@/lib/validation/availability";
import { defineAction, type ActionResult } from "@/lib/actions";

// Cierres del centro por feriado o día excepcional (HU-05, HU-14). Fichas en
// docs/acciones.md.

function revalidateHolidays() {
  revalidatePath("/holidays");
  revalidatePath("/calendar");
  revalidatePath("/agenda");
}

export type HolidayMutationState = ActionResult<{ id: number }> | null;

const create = defineAction({
  roles: ["MANAGER", "RECEPTIONIST"],
  input: createHolidaySchema,
  handler: async (input, actor) => {
    const result = await dal.createHoliday(input, actor);
    revalidateHolidays();
    return result;
  },
});

const remove = defineAction({
  roles: ["MANAGER", "RECEPTIONIST"],
  input: deleteHolidaySchema,
  handler: async (input, actor) => {
    const result = await dal.deleteHoliday(input, actor);
    revalidateHolidays();
    return result;
  },
});

export async function createHoliday(
  _previous: HolidayMutationState,
  formData: FormData,
): Promise<HolidayMutationState> {
  const date = formData.get("date");
  const startDate = formData.get("startDate") ?? date;
  const endDate = formData.get("endDate") ?? date ?? startDate;
  return create({
    startDate,
    endDate,
    allDay: formData.get("allDay"),
    startTime: formData.get("startTime") || null,
    endTime: formData.get("endTime") || null,
    description: formData.get("description"),
  });
}

export async function deleteHoliday(
  _previous: HolidayMutationState,
  formData: FormData,
): Promise<HolidayMutationState> {
  return remove({ id: Number(formData.get("id")) });
}
