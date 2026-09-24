import {
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  ClipboardList,
  Clock,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

// Links del menú lateral. Decide qué se muestra, no qué se puede abrir: eso
// está en `route-access.ts` y, de forma autoritativa, en cada página. Los tests
// verifican que todo link visible para un rol pueda abrirse con ese rol.

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
};

export type NavGroup = { label: string; items: NavItem[] };

const STAFF: readonly Role[] = ["RECEPTIONIST", "PROFESSIONAL", "MANAGER"];
const FRONT_DESK: readonly Role[] = ["RECEPTIONIST", "MANAGER"];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Turnos",
    items: [
      {
        href: "/calendar",
        label: "Calendario",
        icon: CalendarDays,
        roles: FRONT_DESK,
      },
      {
        href: "/appointments/new",
        label: "Nuevo turno",
        icon: CalendarPlus,
        roles: FRONT_DESK,
      },
      // Misma pantalla: el profesional ve la suya y el resto elige de quién
      // (HU-12).
      {
        href: "/agenda",
        label: "Mi agenda",
        icon: CalendarCheck,
        roles: ["PROFESSIONAL"],
      },
      {
        href: "/agenda",
        label: "Agendas",
        icon: CalendarCheck,
        roles: FRONT_DESK,
      },
    ],
  },
  {
    label: "Pacientes",
    items: [
      { href: "/patients", label: "Pacientes", icon: Users, roles: STAFF },
      {
        href: "/patients/new",
        label: "Nuevo paciente",
        icon: UserPlus,
        roles: FRONT_DESK,
      },
    ],
  },
  {
    label: "Centro",
    items: [
      {
        href: "/professionals",
        label: "Profesionales",
        icon: Stethoscope,
        roles: FRONT_DESK,
      },
      {
        href: "/my-schedule",
        label: "Mis horarios",
        icon: Clock,
        roles: ["PROFESSIONAL"],
      },
      {
        href: "/services",
        label: "Servicios",
        icon: ClipboardList,
        roles: STAFF,
      },
      {
        href: "/holidays",
        label: "Feriados",
        icon: CalendarOff,
        roles: STAFF,
      },
      { href: "/users", label: "Usuarios", icon: UserCog, roles: ["MANAGER"] },
    ],
  },
];

/// Los grupos con solo los links de este rol. Un grupo sin links no se muestra.
export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/// El link que corresponde a la ruta actual: el de prefijo más largo, para que
/// en `/patients/new` se marque "Nuevo paciente" y no "Pacientes".
export function activeHref(
  pathname: string,
  groups: NavGroup[],
): string | undefined {
  return groups
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
