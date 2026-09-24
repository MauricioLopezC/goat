"use server";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import { cancelAppointment as cancelInDal } from "@/lib/dal/appointments";
import { cancelAppointmentSchema } from "@/lib/validation/appointments";

export const cancelAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: cancelAppointmentSchema,
  handler: async (input, actor) => {
    const result = await cancelInDal(input, actor);
    revalidatePath("/calendar");
    revalidatePath("/agenda");
    revalidatePath(`/appointments/${input.appointmentId}`);
    return result;
  },
});
