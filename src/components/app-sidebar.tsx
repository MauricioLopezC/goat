import Image from "next/image";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo-goat.png";
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
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Image
            src={logo}
            width={40}
            height={40}
            alt="GOAT"
            className="size-10 shrink-0 rounded-xl"
            loading="eager"
          />
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium leading-snug text-foreground">
              Gestión Ortopédica y
            </span>
            <span className="text-xs font-medium leading-snug text-foreground">
              Atención Traumatológica
            </span>
          </div>
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
