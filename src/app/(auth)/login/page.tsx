import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getSession, landingPath } from "@/lib/dal/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar · GOAT",
};

export default async function LoginPage() {
  // Chequeo autoritativo: si la sesión sigue siendo válida, no hay nada que
  // mostrar acá. Una cookie de un usuario dado de baja cae a `null` y ve el
  // formulario, que es lo correcto.
  const actor = await getSession();
  if (actor) redirect(landingPath(actor.role));

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="gap-2">
            <CardTitle className="text-headline-md">GOAT</CardTitle>
            <CardDescription>
              Ingresá con tu email y contraseña del centro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-center shadow-xs">
          <p className="text-body-sm text-muted-foreground mb-2.5">
            ¿Querés consultar nuestro equipo médico?
          </p>
          <Button asChild variant="outline" size="sm" className="w-full gap-2">
            <Link href="/profesionales">
              <Users className="size-4 text-primary" />
              Conocé a nuestros profesionales
            </Link>
          </Button>
        </div>

        <p className="text-body-sm text-muted-foreground mt-6 text-center">
          ¿No podés ingresar? Pedile al gerente que revise tu usuario.
        </p>
      </div>
    </main>
  );
}
