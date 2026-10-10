"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      variant="outline"
      onClick={() => window.print()}
      className="gap-2 print:hidden"
    >
      <Printer className="size-4" />
      Imprimir o Guardar PDF
    </Button>
  );
}
