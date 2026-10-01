"use server";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import {
  cancelAppointment as cancelInDal,
  completeAppointment as completeInDal,
  expireAppointment as expireInDal,
  rescheduleAppointment as rescheduleInDal,
  updateAppointmentPriority as updatePriorityInDal,
} from "@/lib/dal/appointments";
import {
  registerAuthorization as registerAuthorizationInDal,
  registerPayment as registerPaymentInDal,
  voidPayment as voidPaymentInDal,
} from "@/lib/dal/payments";
import {
  appointmentStatusChangeSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentPrioritySchema,
} from "@/lib/validation/appointments";
import {
  registerAuthorizationSchema,
  registerPaymentSchema,
  voidPaymentSchema,
} from "@/lib/validation/payments";

function revalidateAppointment(appointmentId: number) {
  revalidatePath("/calendar");
  revalidatePath("/agenda");
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath("/payments");
}

// Cerrar un turno cambia la lista de turnos sin cerrar y los indicadores
// (HU-22).
function revalidateClosedAppointment(appointmentId: number) {
  revalidateAppointment(appointmentId);
  revalidatePath("/appointments/unclosed");
  revalidatePath("/dashboard");
}

export const rescheduleAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER", "PROFESSIONAL"],
  input: rescheduleAppointmentSchema,
  handler: async (input, actor) => {
    const result = await rescheduleInDal(input, actor);
    revalidateAppointment(input.appointmentId);
    return result;
  },
});

export const cancelAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER", "PROFESSIONAL"],
  input: cancelAppointmentSchema,
  handler: async (input, actor) => {
    const result = await cancelInDal(input, actor);
    revalidateAppointment(input.appointmentId);
    return result;
  },
});

export const completeAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER", "PROFESSIONAL"],
  input: appointmentStatusChangeSchema,
  handler: async (input, actor) => {
    const result = await completeInDal(input, actor);
    revalidateClosedAppointment(input.appointmentId);
    return result;
  },
});

export const expireAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER", "PROFESSIONAL"],
  input: appointmentStatusChangeSchema,
  handler: async (input, actor) => {
    const result = await expireInDal(input, actor);
    revalidateClosedAppointment(input.appointmentId);
    return result;
  },
});

export const registerPayment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: registerPaymentSchema,
  handler: async (input, actor) => {
    const result = await registerPaymentInDal(input, actor);
    revalidateAppointment(input.appointmentId);
    return result;
  },
});

export const voidPayment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: voidPaymentSchema,
  handler: async (input, actor) => {
    const result = await voidPaymentInDal(input, actor);
    revalidateAppointment(result.appointmentId);
    return result;
  },
});

export const registerAuthorization = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: registerAuthorizationSchema,
  handler: async (input, actor) => {
    const result = await registerAuthorizationInDal(input, actor);
    revalidateAppointment(input.appointmentId);
    return result;
  },
});

export const updateAppointmentPriority = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: updateAppointmentPrioritySchema,
  handler: async (input, actor) => {
    const result = await updatePriorityInDal(input, actor);
    revalidateAppointment(input.appointmentId);
    return result;
  },
});
