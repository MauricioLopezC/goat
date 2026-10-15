"use client";

// Notificación en el navegador para actualizar pantallas en vivo ante cobros y anulaciones (H6).
export function notifyPaymentChange() {
  if (typeof window === "undefined") return;

  try {
    const channel = new BroadcastChannel("goat-payments");
    channel.postMessage({ type: "payment-change", at: Date.now() });
    channel.close();
  } catch {
    // BroadcastChannel no disponible en ciertos entornos
  }

  try {
    window.localStorage.setItem("goat_payment_updated", Date.now().toString());
  } catch {
    // ignore
  }
}
