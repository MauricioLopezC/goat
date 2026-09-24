import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

// Versión con `useSyncExternalStore` del hook que trae shadcn: el original
// hace `setState` dentro de un efecto, que la regla de React de ESLint rechaza.
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // En el servidor no hay ventana: se asume escritorio, como el original.
    () => false,
  );
}
