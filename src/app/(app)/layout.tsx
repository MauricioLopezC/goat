import { LogOut } from "lucide-react";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/login/actions";

const ROLE_LABEL = {
  RECEPTIONIST: "Mesa de entradas",
  PROFESSIONAL: "Profesional",
  MANAGER: "Gerente",
  PATIENT: "Paciente",
} as const;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Barrera autoritativa: `proxy.ts` ya hizo el chequeo optimista, pero es
  // acá donde se relee el usuario y se decide (ADR 0001, ADR 0002).
  const actor = await requirePageRole(...STAFF_ROLES);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border bg-card border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 md:px-6 lg:px-8">
          <span className="bg-primary text-title-md text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            G
          </span>
          <span className="text-title-lg">Goat</span>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-title-md">
                {actor.firstName} {actor.lastName}
              </p>
              <p className="text-label-md text-muted-foreground uppercase">
                {ROLE_LABEL[actor.role]}
              </p>
            </div>
            {/* Cerrar sesión disponible desde cualquier pantalla (HU-01). */}
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut data-icon="inline-start" />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
