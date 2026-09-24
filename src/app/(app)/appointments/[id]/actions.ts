"use server";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import {
  cancelAppointment as cancelInDal,
  completeAppointment as completeInDal,
  expireAppointment as expireInDal,
} from "@/lib/dal/appointments";
import {
  appointmentStatusChangeSchema,
  cancelAppointmentSchema,
} from "@/lib/validation/appointments";

function revalidateAppointment(appointmentId: number) {
  revalidatePath("/calendar");
  revalidatePath("/agenda");
  revalidatePath(`/appointments/${appointmentId}`);
}

export const cancelAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: cancelAppointmentSchema,
  handler: async (input, actor) => {
    const result = await cancelInDal(input, actor);
    revalidateAppointment(input.appointmentId);
    return result;
  },
});

export const completeAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: appointmentStatusChangeSchema,
  handler: async (input, actor) => {
    const result = await completeInDal(input, actor);
    revalidateAppointment(input.appointmentId);
    return result;
  },
});

export const expireAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: appointmentStatusChangeSchema,
  handler: async (input, actor) => {
    const result = await expireInDal(input, actor);
    revalidateAppointment(input.appointmentId);
    return result;
  },
});
