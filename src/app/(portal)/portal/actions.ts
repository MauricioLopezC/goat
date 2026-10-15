"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import { Role } from "@/generated/prisma/enums";
import { changePasswordSchema } from "@/lib/validation/auth";
import { cancelAppointmentSchema } from "@/lib/validation/appointments";
import * as authDal from "@/lib/dal/auth";
import * as appointmentsDal from "@/lib/dal/appointments";

export const changePassword = defineAction({
  roles: [Role.PATIENT],
  input: changePasswordSchema,
  handler: async (input, actor) => {
    const result = await authDal.changePassword(input, actor);
    revalidatePath("/portal");
    revalidatePath("/portal/change-password");
    return result;
  },
});

export const cancelMyAppointment = defineAction({
  roles: [Role.PATIENT],
  input: cancelAppointmentSchema,
  handler: async (input, actor) => {
    const result = await appointmentsDal.cancelAppointment(input, actor);
    revalidatePath("/portal");
    revalidatePath("/appointments");
    return result;
  },
});
