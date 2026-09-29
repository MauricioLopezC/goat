"use server";

import { revalidatePath } from "next/cache";
import * as dal from "@/lib/dal/payment-methods";
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
} from "@/lib/validation/payment-method";
import { defineAction, type ActionResult } from "@/lib/actions";

// ─────────────────────── Acciones con defineAction ────────────────────

const create = defineAction({
  roles: ["MANAGER"],
  input: createPaymentMethodSchema,
  handler: async (input, actor) => {
    const result = await dal.createPaymentMethod(input, actor);
    revalidatePath("/payment-methods");
    return result;
  },
});

const update = defineAction({
  roles: ["MANAGER"],
  input: updatePaymentMethodSchema,
  handler: async (input, actor) => {
    const result = await dal.updatePaymentMethod(input, actor);
    revalidatePath("/payment-methods");
    return result;
  },
});

// ─────────────────────── Tipos exportados ─────────────────────────────

export type PaymentMethodResult = ActionResult<{
  id: number;
  name: string;
  active: boolean;
}>;

// ─────────────────────── Adaptadores para UI ──────────────────────────

/**
 * Server Action: crear un medio de pago (HU-20).
 */
export async function createPaymentMethodAction(
  _prev: PaymentMethodResult | null,
  formData: FormData,
): Promise<PaymentMethodResult> {
  return create({ name: formData.get("name") });
}

/**
 * Server Action: actualizar nombre y estado de un medio de pago (HU-20).
 */
export async function updatePaymentMethodAction(
  _prev: PaymentMethodResult | null,
  formData: FormData,
): Promise<PaymentMethodResult> {
  return update({
    id: formData.get("id"),
    name: formData.get("name"),
    active: formData.get("active"),
  });
}
