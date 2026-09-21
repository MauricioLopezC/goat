import { requirePageRole } from "@/lib/dal/auth";
import { Placeholder } from "../placeholder";

export default async function ProfessionalsPage() {
  await requirePageRole("MANAGER");

  return (
    <Placeholder title="Profesionales" story="HU-04">
      El listado de profesionales del centro, donde aterriza el gerente al
      ingresar.
    </Placeholder>
  );
}
