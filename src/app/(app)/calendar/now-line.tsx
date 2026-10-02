"use client";

import { useSyncExternalStore } from "react";
import { toLocalSlot } from "@/lib/schedule";

// Línea de la hora actual en la vista día, como en Google Calendar. Se
// calcula en el navegador y se mueve sola: la página no se recarga cada
// minuto.

const TICK_MS = 30_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

/// Minuto actual (desde la época). Cambia una vez por minuto, así que sirve
/// de snapshot estable para `useSyncExternalStore`.
function currentMinute() {
  return Math.floor(Date.now() / 60_000);
}

/// En el servidor no se dibuja: la hora del render quedaría vieja y no
/// coincidiría con la del navegador al hidratar.
function serverMinute() {
  return null;
}

export function NowLine({
  date,
  firstHour,
  lastHour,
  hourHeight,
  withDot,
}: {
  date: string;
  firstHour: number;
  lastHour: number;
  hourHeight: number;
  withDot: boolean;
}) {
  const epochMinute = useSyncExternalStore(
    subscribe,
    currentMinute,
    serverMinute,
  );
  if (epochMinute === null) return null;

  const now = toLocalSlot(new Date(epochMinute * 60_000));
  if (now.date !== date) return null;
  if (now.minute < firstHour * 60 || now.minute > lastHour * 60) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-20 h-0.5 -translate-y-1/2 bg-destructive"
      style={{ top: ((now.minute - firstHour * 60) / 60) * hourHeight }}
    >
      {withDot && (
        <span className="absolute top-1/2 left-0 size-2.5 -translate-y-1/2 rounded-full bg-destructive" />
      )}
    </div>
  );
}
