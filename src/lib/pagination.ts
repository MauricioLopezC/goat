/// Paginación de los listados de entidades (pacientes, profesionales,
/// usuarios, servicios, feriados). Numerada, con el total de resultados.
/// La página viaja en la URL como `?page=N`, junto a los filtros.

export const PAGE_SIZE = 10;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/// Lee `?page=` de la URL. Cualquier valor que no sea un entero positivo
/// cuenta como la primera página.
export function parsePageParam(value: string | string[] | undefined): number {
  return typeof value === "string" && /^[1-9]\d{0,8}$/.test(value)
    ? Number(value)
    : 1;
}

/// Ajusta la página pedida al rango que existe: una página más allá de la
/// última (por ejemplo, tras borrar su único registro) muestra la última.
export function pageBounds(
  requested: number,
  total: number,
  pageSize = PAGE_SIZE,
) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), pageCount)
    : 1;
  return { page, pageCount, skip: (page - 1) * pageSize, take: pageSize };
}

/// Cuenta primero y después trae solo la página, ya ajustada al rango.
export async function paginate<T>(
  requested: number,
  count: () => Promise<number>,
  findPage: (range: { skip: number; take: number }) => Promise<T[]>,
): Promise<Page<T>> {
  const total = await count();
  const { page, pageCount, skip, take } = pageBounds(requested, total);
  const items = total === 0 ? [] : await findPage({ skip, take });
  return { items, total, page, pageSize: take, pageCount };
}

export function emptyPage<T>(): Page<T> {
  return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, pageCount: 1 };
}

/// Números de página a mostrar: la primera, la última y las vecinas de la
/// actual; los huecos se marcan con `"ellipsis"`.
export function pageNumbers(
  page: number,
  pageCount: number,
): (number | "ellipsis")[] {
  const shown = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...shown]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);
  return pages.flatMap((n, i) => {
    const previous = pages[i - 1];
    if (previous === undefined || n === previous + 1) return [n];
    // Un hueco de una sola página se muestra con su número, no con "…".
    return n === previous + 2 ? [previous + 1, n] : ["ellipsis" as const, n];
  });
}

/// URL de una página conservando los filtros. La página 1 no lleva `page`.
export function pageHref(
  pathname: string,
  params: Record<string, string | undefined>,
  page: number,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value) search.set(key, value);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}
