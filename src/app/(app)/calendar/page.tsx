import { requirePageRole } from "@/lib/dal/auth";
import { Placeholder } from "../placeholder";

export default async function CalendarPage() {
  await requirePageRole("RECEPTIONIST", "MANAGER");

  return (
    <Placeholder title="Calendario del centro" story="HU-11">
      El calendario del día, que es donde aterriza mesa de entradas al ingresar.
    </Placeholder>
  );
}
