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

const PUBLIC_PATHS = ["/login"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  const session = await getIronSession<SessionPayload>(
    nextProxyCookies(request, response),
    sessionOptions(),
  );

  if (PUBLIC_PATHS.includes(pathname)) {
    // El login se deja pasar siempre. Mandar a otro lado al que ya tiene
    // cookie sería decidir con información vieja: si lo dieron de baja, la
    // página lo devolvería acá y quedaría un bucle. Esa decisión la toma
    // `/login`, que relee la base.
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
