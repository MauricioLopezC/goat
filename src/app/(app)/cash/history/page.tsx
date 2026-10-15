import type { Metadata } from "next";
import Link from "next/link";
import { requirePageRole } from "@/lib/dal/auth";
import { listCashClosings } from "@/lib/dal/cash";
import { parsePageParam } from "@/lib/pagination";
import { formatAmount } from "@/lib/payments";
import { formatDate, formatInstant } from "@/lib/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/list-pagination";
import { ArrowLeft, Eye } from "lucide-react";

export const metadata: Metadata = { title: "Historial de cajas · Goat" };

// Listado histórico de cierres de caja (HU-27).
// Solo accesible por el rol MANAGER.
export default async function CashHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const actor = await requirePageRole("MANAGER");
  const { page } = await searchParams;
  const currentPage = parsePageParam(page);

  const paginated = await listCashClosings(currentPage, actor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 px-2 -ml-2 text-muted-foreground"
            >
              <Link href="/cash">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver a Caja
              </Link>
            </Button>
          </div>
          <h1 className="text-display-lg font-semibold tracking-tight text-foreground">
            Historial de cajas
          </h1>
          <p className="text-body-lg text-muted-foreground mt-1">
            Registro de todas las cajas cerradas del centro policonsultorio.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-title-lg">Cajas cerradas</CardTitle>
          <CardDescription>
            {paginated.total}{" "}
            {paginated.total === 1
              ? "cierre registrado"
              : "cierres registrados"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {paginated.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se han registrado cierres de caja todavía.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-center">Cobros</TableHead>
                  <TableHead className="text-right">Total original</TableHead>
                  <TableHead className="text-right">Total corregido</TableHead>
                  <TableHead className="text-right">Efectivo contado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Cerrada por</TableHead>
                  <TableHead>Fecha de cierre</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.items.map((c) => {
                  const hasAdjustments = c.adjustmentsCount > 0;
                  const diffNum = Number(c.difference);

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <Link
                          href={`/cash?date=${c.date}`}
                          className="hover:underline font-semibold"
                        >
                          {formatDate(c.date)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {c.paymentCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {hasAdjustments ? (
                          <span className="line-through text-muted-foreground text-xs">
                            {formatAmount(c.totalAmount)}
                          </span>
                        ) : (
                          <span className="font-medium">
                            {formatAmount(c.totalAmount)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {hasAdjustments ? (
                          <span className="font-bold text-foreground">
                            {formatAmount(c.correctedTotalAmount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatAmount(c.countedCashAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-medium">
                            {formatAmount(c.difference)}
                          </span>
                          {diffNum === 0 ? (
                            <Badge
                              variant="outline"
                              className="bg-success-soft text-success-soft-foreground border-success-soft-border text-[10px] px-1 py-0"
                            >
                              0
                            </Badge>
                          ) : diffNum < 0 ? (
                            <Badge
                              variant="outline"
                              className="bg-warning-soft text-warning-soft-foreground border-warning-soft-border text-[10px] px-1 py-0"
                            >
                              -
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-info-soft text-info-soft-foreground border-info-soft-border text-[10px] px-1 py-0"
                            >
                              +
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.closedBy.firstName} {c.closedBy.lastName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatInstant(c.closedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 px-2 text-xs"
                        >
                          <Link href={`/cash?date=${c.date}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ver
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <ListPagination
            page={paginated}
            pathname="/cash/history"
            label="Páginas de historial de cajas"
          />
        </CardContent>
      </Card>
    </div>
  );
}
