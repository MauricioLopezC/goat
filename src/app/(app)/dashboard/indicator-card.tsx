import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Tarjeta de un indicador del tablero (HU-22): el valor en negrita tabular,
// la pista de ocupación o ausentismo cuando es una tasa (docs/DESIGN.md), el
// detalle y la fórmula como ayuda.
export function IndicatorCard({
  title,
  value,
  meter,
  detail,
  formula,
}: {
  title: string;
  value: string;
  /// Tasa entre 0 y 1 para la pista; `null` sin datos, sin pista si no es tasa.
  meter?: number | null;
  detail: string;
  formula: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-display-lg tabular-nums">{value}</p>
        {meter !== undefined && (
          <Progress
            value={meter === null ? 0 : Math.round(meter * 100)}
            aria-label={`${title}: ${value}`}
            className="bg-border h-2"
          />
        )}
        <p className="text-sm">{detail}</p>
        <p className="text-muted-foreground mt-auto text-xs">{formula}</p>
      </CardContent>
    </Card>
  );
}
