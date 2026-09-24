import { LogOut } from "lucide-react";
import type { Actor } from "@/lib/dal/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { signOut } from "@/app/(auth)/login/actions";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

// Navegación principal de la app: marca, links según el rol y el usuario con
// su botón de salida (HU-01: cerrar sesión desde cualquier pantalla).
export function AppSidebar({ actor }: { actor: Actor }) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="bg-primary text-title-md text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            G
          </span>
          <span className="text-title-lg">Goat</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <AppSidebarNav role={actor.role} />
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col px-2 py-1.5">
          <p className="text-title-md truncate">
            {actor.firstName} {actor.lastName}
          </p>
          <p className="text-label-md text-muted-foreground uppercase">
            {ROLE_LABEL[actor.role]}
          </p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit">
                <LogOut />
                <span>Salir</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
