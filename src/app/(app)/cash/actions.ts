"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import { closeCash as closeCashInDal } from "@/lib/dal/cash";
import { voidPayment as voidPaymentInDal } from "@/lib/dal/payments";
import { closeCashSchema } from "@/lib/validation/cash";
import { voidPaymentSchema } from "@/lib/validation/payments";

// Server Actions para la pantalla Caja (HU-27).

export const closeCash = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: closeCashSchema,
  handler: async (input, actor) => {
    const result = await closeCashInDal(input, actor);
    revalidatePath("/cash");
    revalidatePath("/today");
    revalidatePath("/cash/history");
    return result;
  },
});

export const voidCashPayment = defineAction({
  roles: ["MANAGER"],
  input: voidPaymentSchema,
  handler: async (input, actor) => {
    const result = await voidPaymentInDal(input, actor);
    revalidatePath("/cash");
    revalidatePath("/today");
    revalidatePath("/cash/history");
    revalidatePath("/calendar");
    revalidatePath("/agenda");
    revalidatePath(`/appointments/${result.appointmentId}`);
    return result;
  },
});
