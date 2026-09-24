import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { pageHref, pageNumbers, type Page } from "@/lib/pagination";

/// Pie de un listado paginado: rango mostrado, total y links numerados.
/// `params` son los filtros vigentes, que cada link conserva.
export function ListPagination({
  page,
  pathname,
  params = {},
  label,
}: {
  page: Omit<Page<unknown>, "items">;
  pathname: string;
  params?: Record<string, string | undefined>;
  /// Qué se lista, para el lector de pantalla: "Páginas de pacientes".
  label: string;
}) {
  // Con una sola página no hace falta: cada listado ya muestra su total.
  if (page.pageCount <= 1) return null;

  const first = (page.page - 1) * page.pageSize + 1;
  const last = Math.min(page.page * page.pageSize, page.total);
  const href = (n: number) => pageHref(pathname, params, n);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-body-sm text-muted-foreground tabular-nums">
        Mostrando {first === last ? first : `${first}–${last}`} de {page.total}
      </p>
      <Pagination aria-label={label} className="mx-0 w-auto">
        <PaginationContent>
          {page.page > 1 && (
            <PaginationItem>
              <PaginationPrevious href={href(page.page - 1)} />
            </PaginationItem>
          )}
          {pageNumbers(page.page, page.pageCount).map((n, i) =>
            n === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={n}>
                <PaginationLink
                  href={href(n)}
                  isActive={n === page.page}
                  aria-label={`Página ${n}`}
                  className="tabular-nums"
                >
                  {n}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          {page.page < page.pageCount && (
            <PaginationItem>
              <PaginationNext href={href(page.page + 1)} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}
