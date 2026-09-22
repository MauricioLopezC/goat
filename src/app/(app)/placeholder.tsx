import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Pantalla inicial de cada rol (HU-01). El contenido real lo construye la
// historia indicada; acá solo se verifica que el rol correcto llega y el
// incorrecto no.
export function Placeholder({
  title,
  story,
  children,
}: {
  title: string;
  story: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-headline-md">{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body-sm text-muted-foreground">
          Esta pantalla se construye en {story}. HU-01 solo define que este rol
          aterriza acá al ingresar.
        </p>
      </CardContent>
    </Card>
  );
}
