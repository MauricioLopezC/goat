import { requirePageRole } from "@/lib/dal/auth";
import { Placeholder } from "../../placeholder";

export default async function NewAppointmentPage() {
  await requirePageRole("RECEPTIONIST", "MANAGER");

  return (
    <Placeholder title="Nuevo turno" story="HU-09">
      Asignación de turnos a pacientes.
    </Placeholder>
  );
}
