import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pageBounds,
  pageHref,
  pageNumbers,
  paginate,
  parsePageParam,
} from "../src/lib/pagination";

test("la página de la URL solo acepta enteros positivos", () => {
  assert.equal(parsePageParam("3"), 3);
  assert.equal(parsePageParam(undefined), 1);
  assert.equal(parsePageParam(""), 1);
  assert.equal(parsePageParam("0"), 1);
  assert.equal(parsePageParam("-2"), 1);
  assert.equal(parsePageParam("2.5"), 1);
  assert.equal(parsePageParam("abc"), 1);
  assert.equal(parsePageParam(["2", "3"]), 1);
  assert.equal(parsePageParam("99999999999"), 1);
});

test("la página pedida se ajusta al rango que existe", () => {
  assert.deepEqual(pageBounds(1, 0), {
    page: 1,
    pageCount: 1,
    skip: 0,
    take: 10,
  });
  assert.deepEqual(pageBounds(2, 25), {
    page: 2,
    pageCount: 3,
    skip: 10,
    take: 10,
  });
  assert.equal(pageBounds(9, 25).page, 3);
  assert.equal(pageBounds(4, 30).page, 3);
  assert.equal(pageBounds(0, 30).page, 1);
});

test("paginate trae la página ajustada y no consulta si no hay resultados", async () => {
  const rows = Array.from({ length: 23 }, (_, i) => i + 1);
  const page = await paginate(
    5,
    async () => rows.length,
    async ({ skip, take }) => rows.slice(skip, skip + take),
  );
  assert.deepEqual(page, {
    items: [21, 22, 23],
    total: 23,
    page: 3,
    pageSize: 10,
    pageCount: 3,
  });

  let queried = false;
  const empty = await paginate(
    2,
    async () => 0,
    async () => {
      queried = true;
      return [];
    },
  );
  assert.equal(queried, false);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.page, 1);
});

test("los números de página marcan los huecos", () => {
  assert.deepEqual(pageNumbers(1, 1), [1]);
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(1, 10), [1, 2, "ellipsis", 10]);
  assert.deepEqual(pageNumbers(5, 10), [
    1,
    "ellipsis",
    4,
    5,
    6,
    "ellipsis",
    10,
  ]);
  assert.deepEqual(pageNumbers(3, 10), [1, 2, 3, 4, "ellipsis", 10]);
  assert.deepEqual(pageNumbers(10, 10), [1, "ellipsis", 9, 10]);
});

test("la URL de una página conserva los filtros", () => {
  assert.equal(pageHref("/users", {}, 1), "/users");
  assert.equal(pageHref("/users", {}, 2), "/users?page=2");
  assert.equal(
    pageHref("/professionals", { q: "pérez", serviceId: undefined }, 3),
    "/professionals?q=p%C3%A9rez&page=3",
  );
});
