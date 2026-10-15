"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 5000;

export function CashAutoRefresh(_props?: { isClosed?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    // 1. Refresco periódico cuando la pestaña está visible (H6, R3)
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, REFRESH_INTERVAL_MS);

    // 2. Refresco al volver a enfocar la ventana o cambiar visibilidad
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const handleFocus = () => {
      router.refresh();
    };

    // 3. Sincronización inmediata entre pestañas del mismo navegador
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("goat-payments");
      channel.onmessage = () => {
        router.refresh();
      };
    } catch {
      // Ignorar si no está soportado
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "goat_payment_updated") {
        router.refresh();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      if (channel) {
        channel.close();
      }
    };
  }, [router]);

  return null;
}
