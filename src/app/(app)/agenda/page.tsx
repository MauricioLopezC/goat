import { requirePageRole } from "@/lib/dal/auth";
import { Placeholder } from "../placeholder";

export default async function AgendaPage() {
  const actor = await requirePageRole("PROFESSIONAL");

  return (
    <Placeholder title={`Agenda de ${actor.lastName}`} story="HU-12">
      Tu agenda del día. Un profesional ve solo la suya, nunca la de sus
      colegas.
    </Placeholder>
  );
}
