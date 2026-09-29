import type { Metadata } from "next";
import { requirePageRole } from "@/lib/dal/auth";
import { listPaymentMethods } from "@/lib/dal/payment-methods";
import { PaymentMethodsManager } from "./payment-methods-manager";

export const metadata: Metadata = {
  title: "Medios de pago · Goat",
  description:
    "Configuración de medios de pago aceptados por el centro de traumatología (HU-20).",
};

export default async function PaymentMethodsPage() {
  // HU-20: MANAGER configura; RECEPTIONIST solo consulta.
  const actor = await requirePageRole("MANAGER", "RECEPTIONIST");

  const methods = await listPaymentMethods(actor);
  const isManager = actor.role === "MANAGER";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Medios de pago
        </h1>
        <p className="text-sm text-muted-foreground">
          Medios de pago habilitados para el cobro de turnos en el mostrador.
        </p>
      </div>

      <PaymentMethodsManager methods={methods} isManager={isManager} />
    </div>
  );
}
