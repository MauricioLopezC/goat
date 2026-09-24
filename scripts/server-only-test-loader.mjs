import { registerHooks } from "node:module";

// Next reemplaza este marcador durante el build del servidor. Las pruebas
// de integración corren fuera de Next: solo neutralizan el marcador, nunca
// la autenticación, Prisma ni la DAL que se está verificando.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      const marker = nextResolve(specifier, context);
      return { ...marker, url: new URL("empty.js", marker.url).href };
    }
    return nextResolve(specifier, context);
  },
});
