import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, landingPath } from "@/lib/dal/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar · Goat",
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
            <CardTitle className="text-headline-md">Goat</CardTitle>
            <CardDescription>
              Ingresá con tu email y contraseña del centro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-body-sm text-muted-foreground mt-6 text-center">
          ¿No podés ingresar? Pedile al gerente que revise tu usuario.
        </p>
      </div>
    </main>
  );
}
