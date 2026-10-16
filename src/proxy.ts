import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import { sessionOptions, type SessionPayload } from "@/lib/session-config";
import { canAccess } from "@/lib/route-access";

// Chequeo optimista y nada más (ADR 0001, regla 6). Corre en cada ruta,
// incluidas las de prefetch, así que solo lee la cookie: no consulta la base.
//
// NO es una barrera de seguridad. La verificación autoritativa la hace
// `requireRole()` dentro de cada página y cada acción, releyendo el usuario.
// Si este archivo desapareciera, el sistema seguiría siendo seguro; solo
// mostraría el login más tarde.

const PUBLIC_PATHS = ["/login", "/profesionales"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  if (pathname.startsWith("/uploads/")) {
    return response;
  }

  const session = await getIronSession<SessionPayload>(
    nextProxyCookies(request, response),
    sessionOptions(),
  );

  if (PUBLIC_PATHS.includes(pathname)) {
    // El login y las pantallas públicas se dejan pasar siempre.
    return response;
  }

  if (!session.userId) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // Qué rol abre cada ruta está en `route-access.ts`, compartido con el menú.
  if (session.role && !canAccess(pathname, session.role)) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
