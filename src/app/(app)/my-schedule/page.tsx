import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { DomainError } from "@/lib/actions";
import { requirePageRole } from "@/lib/dal/auth";
import { getOwnProfessionalId } from "@/lib/dal/availability";

// Acceso directo del profesional a sus horarios de atención (HU-05), sin
// buscarse en el listado de profesionales. No tiene pantalla propia.
export default async function MySchedulePage() {
  const actor = await requirePageRole("PROFESSIONAL");

  let professionalId;
  try {
    professionalId = await getOwnProfessionalId(actor);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND")
      return (
        <Alert className="bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-border max-w-xl">
          <AlertDescription className="text-destructive-soft-foreground">
            {error.message}
          </AlertDescription>
        </Alert>
      );
    throw error;
  }

  // Fuera del `try`: `redirect` lanza una excepción que Next tiene que ver.
  redirect(`/professionals/${professionalId}/schedule`);
}
