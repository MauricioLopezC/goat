import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DomainError } from "@/lib/actions";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { getProfessionalAgenda } from "@/lib/dal/appointments";
import { listProfessionals } from "@/lib/dal/professionals";
import { isCalendarDate } from "@/lib/schedule";
import { Role } from "@/generated/prisma/enums";
import { AgendaView } from "./agenda-view";
import { AgendaProfessionalPicker } from "./agenda-professional-picker";

export const metadata: Metadata = { title: "Agenda · Goat" };

export default async function AgendaPage({
  searchParams,
}: PageProps<"/agenda">) {
  // HU-12: Barrera de acceso para profesionales y personal administrativo
  const actor = await requirePageRole(...STAFF_ROLES);

  const { date, view, hideCancelled, professionalId } = await searchParams;

  const validDate =
    typeof date === "string" && isCalendarDate(date) ? date : undefined;
  const viewMode = view === "day" ? "day" : "week";
  const hide = hideCancelled === "1" || hideCancelled === "true";
  const profId =
    typeof professionalId === "string" && Number(professionalId) > 0
      ? Number(professionalId)
      : undefined;

  const isStaff = actor.role !== Role.PROFESSIONAL;
  let activeProfessionals: Awaited<ReturnType<typeof listProfessionals>> = [];

  if (isStaff) {
    activeProfessionals = await listProfessionals({ status: "active" }, actor);

    if (!profId) {
      if (activeProfessionals.length === 0) {
        return (
          <Alert className="max-w-xl">
            <AlertDescription>
              No hay profesionales registrados o activos en el centro de
              atención.
            </AlertDescription>
          </Alert>
        );
      }
      return (
        <AgendaProfessionalPicker
          professionals={activeProfessionals}
          date={validDate}
          view={viewMode}
        />
      );
    }
  }

  let data;
  try {
    data = await getProfessionalAgenda(
      {
        date: validDate,
        view: viewMode,
        hideCancelled: hide,
        professionalId: profId,
      },
      actor,
    );
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    if (
      error instanceof DomainError &&
      (error.code === "FORBIDDEN" || error.code === "VALIDATION")
    ) {
      return (
        <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border max-w-xl">
          <AlertDescription className="text-destructive-soft-foreground">
            {error.message ||
              "No tenés permiso para ver la agenda de este profesional."}
          </AlertDescription>
        </Alert>
      );
    }
    throw error;
  }

  return (
    <AgendaView
      data={data}
      professionals={isStaff ? activeProfessionals : undefined}
      isStaff={isStaff}
    />
  );
}
