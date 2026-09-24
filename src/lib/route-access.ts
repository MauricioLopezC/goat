import type { Role } from "@/generated/prisma/enums";

// Qué roles pueden abrir cada ruta. Lo lee `proxy.ts` para cortar temprano y
// lo verifican los tests del menú (un link visible tiene que poder abrirse).
// No lleva `server-only`: también lo usan el sidebar y las pruebas.
//
// NO es la barrera de seguridad: esa es `requirePageRole()` en cada página y
// `assertRole()` en la DAL (ADR 0001). Si esta tabla y una página no coinciden,
// manda la página; mantenerlas alineadas solo evita pedir páginas de más.

type RouteRule = { pattern: RegExp; roles: readonly Role[] };

const STAFF: readonly Role[] = ["RECEPTIONIST", "PROFESSIONAL", "MANAGER"];
const FRONT_DESK: readonly Role[] = ["RECEPTIONIST", "MANAGER"];

/// Se evalúan en orden y gana la primera que coincide, así que las rutas más
/// específicas van antes que su prefijo. Lo que no está acá solo requiere
/// sesión.
const ROUTE_RULES: RouteRule[] = [
  { pattern: /^\/appointments\/new(\/|$)/, roles: FRONT_DESK },
  { pattern: /^\/patients\/new(\/|$)/, roles: FRONT_DESK },
  { pattern: /^\/patients\/[^/]+\/edit(\/|$)/, roles: FRONT_DESK },
  { pattern: /^\/professionals\/new(\/|$)/, roles: ["MANAGER"] },
  { pattern: /^\/professionals\/[^/]+\/edit(\/|$)/, roles: ["MANAGER"] },
  // El detalle y las franjas de un profesional los ve todo el personal.
  { pattern: /^\/professionals\/[^/]+(\/|$)/, roles: STAFF },
  { pattern: /^\/professionals\/?$/, roles: FRONT_DESK },
  { pattern: /^\/services(\/|$)/, roles: STAFF },
  { pattern: /^\/holidays(\/|$)/, roles: STAFF },
  { pattern: /^\/users(\/|$)/, roles: ["MANAGER"] },
  { pattern: /^\/agenda(\/|$)/, roles: STAFF },
  { pattern: /^\/my-schedule(\/|$)/, roles: ["PROFESSIONAL"] },
  { pattern: /^\/calendar(\/|$)/, roles: FRONT_DESK },
];

/// ¿Puede este rol abrir esta ruta? `pathname` sin query string.
export function canAccess(pathname: string, role: Role): boolean {
  const rule = ROUTE_RULES.find((entry) => entry.pattern.test(pathname));
  return !rule || rule.roles.includes(role);
}
