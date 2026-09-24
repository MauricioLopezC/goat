import { cookies } from "next/headers";
import { requirePageRole, STAFF_ROLES } from "@/lib/dal/auth";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// La cookie que escribe el `SidebarProvider` de shadcn. No se importa de
// `sidebar.tsx`: es un módulo de cliente y en el servidor sus constantes llegan
// como referencias, no como valores.
const SIDEBAR_COOKIE_NAME = "sidebar_state";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Barrera autoritativa: `proxy.ts` ya hizo el chequeo optimista, pero es
  // acá donde se relee el usuario y se decide (ADR 0001, ADR 0002).
  const actor = await requirePageRole(...STAFF_ROLES);

  // El sidebar recuerda si quedó abierto o cerrado; sin cookie, abierto.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar actor={actor} />
      {/* `SidebarInset` ya es el <main>. `min-w-0` evita que el contenido
          ancho (la grilla del calendario) empuje la página en vez de hacer
          scroll dentro de su tarjeta. */}
      <SidebarInset className="min-w-0">
        <header className="border-border bg-card flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>

        {/* Ancho de lectura por defecto; una página con `data-layout="wide"`
            (el calendario) usa todo el ancho disponible. */}
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 has-[[data-layout=wide]]:max-w-none md:px-6 lg:px-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
