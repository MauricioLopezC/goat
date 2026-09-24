import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DomainError } from "@/lib/actions";
import { requirePageRole } from "@/lib/dal/auth";
import { getProfessionalAgenda } from "@/lib/dal/appointments";
import { isCalendarDate } from "@/lib/schedule";
import { AgendaView } from "./agenda-view";

export const metadata: Metadata = { title: "Mi agenda · Goat" };

export default async function AgendaPage({
  searchParams,
}: PageProps<"/agenda">) {
  // HU-12: Barrera de acceso estricta para profesionales en /agenda
  const actor = await requirePageRole("PROFESSIONAL");

  const { date, view, hideCancelled, professionalId } = await searchParams;

  const validDate =
    typeof date === "string" && isCalendarDate(date) ? date : undefined;
  const viewMode = view === "day" ? "day" : "week";
  const hide = hideCancelled === "1" || hideCancelled === "true";
  const profId =
    typeof professionalId === "string" && Number(professionalId) > 0
      ? Number(professionalId)
      : undefined;

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
    if (error instanceof DomainError && error.code === "FORBIDDEN") {
      return (
        <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border max-w-xl">
          <AlertDescription className="text-destructive-soft-foreground">
            {error.message ||
              "No tenés permiso para ver la agenda de otro profesional."}
          </AlertDescription>
        </Alert>
      );
    }
    throw error;
  }

  return <AgendaView data={data} />;
}
