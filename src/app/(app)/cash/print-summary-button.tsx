"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botón para imprimir el resumen de la caja (HU-27).
export function PrintSummaryButton({ className }: { className?: string }) {
  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => window.print()}
    >
      <Printer className="h-4 w-4 mr-1.5" />
      Imprimir resumen
    </Button>
  );
}
