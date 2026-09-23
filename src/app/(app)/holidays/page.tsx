import type { Metadata } from "next";

import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { listHolidays } from "@/lib/dal/availability";

import { HolidaysManager } from "./holidays-manager";

export const metadata: Metadata = {
  title: "Feriados · Goat",
  description: "Días en que el centro permanece cerrado (HU-05).",
};

export default async function HolidaysPage() {
  // HU-05: MANAGER administra; RECEPTIONIST y PROFESSIONAL consultan.
  const actor = await requirePageRole(...STAFF_ROLES);
  const holidays = await listHolidays(actor);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-headline-lg">Feriados</h1>
        <p className="text-muted-foreground">
          Días en que el centro permanece cerrado: no se ofrecen turnos para
          ningún profesional.
        </p>
      </div>

      <HolidaysManager holidays={holidays} canEdit={actor.role === "MANAGER"} />
    </div>
  );
}
