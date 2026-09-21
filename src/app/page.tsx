import { redirect } from "next/navigation";
import { landingPath, requirePageRole } from "@/lib/dal/auth";

// La raíz no tiene pantalla propia: manda a cada rol a la suya (HU-01).
// Sin sesión, `requireRole` redirige al login.
export default async function Home() {
  const actor = await requirePageRole();
  redirect(landingPath(actor.role));
}
