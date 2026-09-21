import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import { sessionOptions, type SessionPayload } from "@/lib/session-config";
import { Role } from "@/generated/prisma/enums";

// Chequeo optimista y nada más (ADR 0001, regla 6). Corre en cada ruta,
// incluidas las de prefetch, así que solo lee la cookie: no consulta la base.
//
// NO es una barrera de seguridad. La verificación autoritativa la hace
// `requireRole()` dentro de cada página y cada acción, releyendo el usuario.
// Si este archivo desapareciera, el sistema seguiría siendo seguro; solo
// mostraría el login más tarde.

/// Prefijo de ruta → roles que pueden verla. Lo que no está acá solo requiere
/// sesión.
const BY_ROLE: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/professionals", roles: [Role.MANAGER] },
  { prefix: "/users", roles: [Role.MANAGER] },
  { prefix: "/agenda", roles: [Role.PROFESSIONAL] },
  { prefix: "/calendar", roles: [Role.RECEPTIONIST, Role.MANAGER] },
];

const PUBLIC_PATHS = ["/login"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  const session = await getIronSession<SessionPayload>(
    nextProxyCookies(request, response),
    sessionOptions(),
  );

  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!session.userId) {
    if (isPublic) return response;
    const url = new URL("/login", request.nextUrl);
    return NextResponse.redirect(url);
  }

  // Ya autenticado: el login no tiene nada que ofrecerle.
  if (isPublic) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  const rule = BY_ROLE.find((entry) => pathname.startsWith(entry.prefix));
  if (rule && session.role && !rule.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
