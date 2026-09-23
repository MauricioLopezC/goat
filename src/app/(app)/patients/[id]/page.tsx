import { requirePageRole } from "@/lib/dal/auth";
import { Placeholder } from "../../placeholder";

export default async function PatientDetailPage() {
  await requirePageRole("RECEPTIONIST", "MANAGER", "PROFESSIONAL");

  return (
    <Placeholder title="Ficha del paciente" story="HU-08">
      Búsqueda, detalle y modificación de datos del paciente.
    </Placeholder>
  );
}
