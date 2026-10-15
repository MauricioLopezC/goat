"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import { Role } from "@/generated/prisma/enums";
import { changePasswordSchema } from "@/lib/validation/auth";
import {
  availableSlotsSchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  earliestSlotsSchema,
} from "@/lib/validation/appointments";
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

export const bookPortalAppointment = defineAction({
  roles: [Role.PATIENT],
  input: createAppointmentSchema,
  handler: async (input, actor) => {
    const result = await appointmentsDal.createAppointment(input, actor);
    revalidatePath("/portal");
    revalidatePath("/calendar");
    revalidatePath("/agenda");
    return result;
  },
});

export const getEarliestSlotsAction = defineAction({
  roles: [Role.PATIENT],
  input: earliestSlotsSchema,
  handler: async (input, actor) => {
    return appointmentsDal.listEarliestSlots(input, actor);
  },
});

export const getAvailableSlotsAction = defineAction({
  roles: [Role.PATIENT],
  input: availableSlotsSchema,
  handler: async (input, actor) => {
    return appointmentsDal.listAvailableSlots(input, actor);
  },
});

export const getAvailableDatesAction = defineAction({
  roles: [Role.PATIENT],
  input: availableSlotsSchema.omit({ date: true }),
  handler: async (input, actor) => {
    return appointmentsDal.listAvailableDates(input, actor);
  },
});
