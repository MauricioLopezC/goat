import type { Metadata } from "next";

import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { listHolidays } from "@/lib/dal/availability";
import { parsePageParam } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";

import { HolidaysManager } from "./holidays-manager";

export const metadata: Metadata = {
  title: "Feriados · Goat",
  description: "Días en que el centro permanece cerrado (HU-05).",
};

export default async function HolidaysPage({
  searchParams,
}: PageProps<"/holidays">) {
  // HU-05: MANAGER administra; RECEPTIONIST y PROFESSIONAL consultan.
  const actor = await requirePageRole(...STAFF_ROLES);
  const { page } = await searchParams;
  const holidaysPage = await listHolidays(parsePageParam(page), actor);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg">Feriados</h1>
        <p className="text-muted-foreground">
          Días en que el centro permanece cerrado: no se ofrecen turnos para
          ningún profesional.
        </p>
      </div>

      <HolidaysManager
        holidays={holidaysPage.items}
        canEdit={actor.role === "MANAGER"}
        pagination={
          <ListPagination
            page={holidaysPage}
            pathname="/holidays"
            label="Páginas de feriados"
          />
        }
      />
    </div>
  );
}
