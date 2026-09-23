import type { Metadata } from "next";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { listServices, listActiveSpecialties } from "@/lib/dal/services";
import { ServicesManager } from "./services-manager";

export const metadata: Metadata = {
  title: "Servicios · Goat",
  description:
    "Catálogo de prestaciones y servicios del centro de traumatología (HU-06).",
};

export default async function ServicesPage() {
  // HU-06: MANAGER administra; RECEPTIONIST y PROFESSIONAL tienen solo lectura.
  const actor = await requirePageRole(...STAFF_ROLES);

  const [services, specialties] = await Promise.all([
    listServices(actor),
    listActiveSpecialties(actor),
  ]);

  const isManager = actor.role === "MANAGER";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Catálogo de servicios
        </h1>
        <p className="text-sm text-muted-foreground">
          Prestaciones clínicas y terapéuticas habilitadas para el otorgamiento
          de turnos.
        </p>
      </div>

      <ServicesManager
        services={services}
        specialties={specialties}
        isManager={isManager}
      />
    </div>
  );
}
