"use server";

import { revalidatePath } from "next/cache";
import * as dal from "@/lib/dal/availability";
import {
  createHolidaySchema,
  deleteHolidaySchema,
} from "@/lib/validation/availability";
import { defineAction, type ActionResult } from "@/lib/actions";

// Feriados del centro (HU-05). Fichas en docs/acciones.md.

function revalidateHolidays() {
  revalidatePath("/holidays");
  revalidatePath("/calendar");
}

export type HolidayMutationState = ActionResult<{ id: number }> | null;

const create = defineAction({
  roles: ["MANAGER"],
  input: createHolidaySchema,
  handler: async (input, actor) => {
    const result = await dal.createHoliday(input, actor);
    revalidateHolidays();
    return result;
  },
});

const remove = defineAction({
  roles: ["MANAGER"],
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
  return create({
    date: formData.get("date"),
    description: formData.get("description"),
  });
}

export async function deleteHoliday(
  _previous: HolidayMutationState,
  formData: FormData,
): Promise<HolidayMutationState> {
  return remove({ id: Number(formData.get("id")) });
}
