"use server";

import { revalidatePath } from "next/cache";
import * as dal from "@/lib/dal/availability";
import {
  createAvailabilityExceptionSchema,
  createAvailabilityWindowSchema,
  deleteAvailabilityExceptionSchema,
  deleteAvailabilityWindowSchema,
  updateAvailabilityWindowSchema,
} from "@/lib/validation/availability";
import { defineAction, type ActionResult } from "@/lib/actions";

// Agenda de un profesional (HU-05). Fichas en docs/acciones.md.

/// Al cambiar la agenda cambian la ficha, esta pantalla y la disponibilidad
/// que muestra el calendario (HU-11).
function revalidateSchedule(professionalId: number) {
  revalidatePath(`/professionals/${professionalId}`);
  revalidatePath(`/professionals/${professionalId}/schedule`);
  revalidatePath("/calendar");
}

export type ScheduleMutationState = ActionResult<{ id: number }> | null;

function readWindow(formData: FormData) {
  const roomId = formData.get("roomId");
  return {
    professionalId: Number(formData.get("professionalId")),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    // "none" es la opción "Sin consultorio" del select.
    roomId: roomId && roomId !== "none" ? Number(roomId) : null,
    serviceIds: formData.getAll("serviceIds").map(Number),
  };
}

const createWindow = defineAction({
  roles: ["MANAGER"],
  input: createAvailabilityWindowSchema,
  handler: async (input, actor) => {
    const result = await dal.createAvailabilityWindow(input, actor);
    revalidateSchedule(input.professionalId);
    return result;
  },
});

const updateWindow = defineAction({
  roles: ["MANAGER"],
  input: updateAvailabilityWindowSchema,
  handler: async (input, actor) => {
    const result = await dal.updateAvailabilityWindow(input, actor);
    revalidateSchedule(input.professionalId);
    return result;
  },
});

const deleteWindow = defineAction({
  roles: ["MANAGER"],
  input: deleteAvailabilityWindowSchema,
  handler: async (input, actor) => {
    const result = await dal.deleteAvailabilityWindow(input, actor);
    revalidateSchedule(input.professionalId);
    return result;
  },
});

const createException = defineAction({
  roles: ["MANAGER"],
  input: createAvailabilityExceptionSchema,
  handler: async (input, actor) => {
    const result = await dal.createAvailabilityException(input, actor);
    revalidateSchedule(input.professionalId);
    return result;
  },
});

const deleteException = defineAction({
  roles: ["MANAGER"],
  input: deleteAvailabilityExceptionSchema,
  handler: async (input, actor) => {
    const result = await dal.deleteAvailabilityException(input, actor);
    revalidateSchedule(input.professionalId);
    return result;
  },
});

/// Alta o modificación de una franja: con `id` modifica.
export async function saveAvailabilityWindow(
  _previous: ScheduleMutationState,
  formData: FormData,
): Promise<ScheduleMutationState> {
  const id = formData.get("id");
  return id
    ? updateWindow({ ...readWindow(formData), id: Number(id) })
    : createWindow(readWindow(formData));
}

export async function deleteAvailabilityWindow(
  _previous: ScheduleMutationState,
  formData: FormData,
): Promise<ScheduleMutationState> {
  return deleteWindow({
    id: Number(formData.get("id")),
    professionalId: Number(formData.get("professionalId")),
  });
}

export async function createAvailabilityException(
  _previous: ScheduleMutationState,
  formData: FormData,
): Promise<ScheduleMutationState> {
  return createException({
    professionalId: Number(formData.get("professionalId")),
    date: formData.get("date"),
    allDay: formData.get("allDay"),
    startTime: formData.get("startTime") || null,
    endTime: formData.get("endTime") || null,
    reason: formData.get("reason"),
  });
}

export async function deleteAvailabilityException(
  _previous: ScheduleMutationState,
  formData: FormData,
): Promise<ScheduleMutationState> {
  return deleteException({
    id: Number(formData.get("id")),
    professionalId: Number(formData.get("professionalId")),
  });
}
