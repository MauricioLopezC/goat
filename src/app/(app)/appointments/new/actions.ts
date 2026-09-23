"use server";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import { createAppointment as createInDal } from "@/lib/dal/appointments";
import { createAppointmentSchema } from "@/lib/validation/appointments";
export const createAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: createAppointmentSchema,
  handler: async (input, actor) => {
    const result = await createInDal(input, actor);
    revalidatePath("/calendar");
    revalidatePath("/agenda");
    revalidatePath("/appointments/new");
    revalidatePath(`/professionals/${input.professionalId}`);
    return result;
  },
});
