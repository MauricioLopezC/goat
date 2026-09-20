# ADR 0001 — Server Actions y capa de acceso a datos (DAL)

- **Estado:** aceptada
- **Fecha:** 2026-09-20
- **Alcance:** cómo el frontend lee y modifica datos en el servidor.

## Contexto

Goat es una aplicación Next.js (App Router) con un único cliente: su propia interfaz web. No hay app móvil nativa ni API pública (fuera de alcance), y los usuarios son personal interno con distintos roles (`RECEPTIONIST`, `PROFESSIONAL`, `MANAGER`).

Hay que decidir si el acceso a datos se resuelve con una API (Route Handlers) o con Server Actions. Las reglas que no se negocian (sin turnos superpuestos, trazabilidad, control de acceso por rol) tienen que cumplirse sin importar por dónde entre la operación.

Esta decisión se apoya en la documentación de la versión instalada (Next.js 16.3.5): `01-app/01-getting-started/07-mutating-data.md`, `02-guides/server-actions.md`, `02-guides/backend-for-frontend.md`, `02-guides/data-security.md` y `02-guides/authentication.md`.

## Decisión

1. **Lecturas:** en Server Components, llamando directamente a la DAL. No se consumen Route Handlers propios desde el servidor.
2. **Mutaciones:** Server Actions (`"use server"`).
3. **Capa de acceso a datos (DAL):** módulos `server-only` en `src/lib/dal/`. Concentran autorización, reglas de negocio y acceso a Prisma. Las Server Actions son adaptadores finos que no contienen reglas de negocio.
4. **Contrato uniforme:** todas las acciones devuelven `ActionResult<T>` y siguen el mismo flujo. Ver [`docs/acciones.md`](../acciones.md).
5. **Route Handlers:** solo cuando exista un consumidor externo (webhooks, integraciones con obras sociales, una futura app móvil) o una lectura del lado del cliente con polling. No se usan para la interfaz propia.
6. **Proxy (`proxy.ts`, antes middleware):** solo chequeos optimistas leyendo la cookie de sesión (hay sesión, el rol puede entrar a la sección). Nunca es la única barrera.

### Flujo de una mutación

```
Formulario / evento
  → Server Action (src/app/**/actions.ts)
      1. sesión y rol
      2. validar entrada (Zod)
      3. DAL: regla de negocio + Prisma (src/lib/dal/)
      4. revalidatePath / revalidateTag
      5. ActionResult<T>
```

### Autenticación

La elección de librería y el modelo de sesión se deciden en un ADR aparte (pendiente). Lo que sí queda fijado acá es la interfaz que el resto del código puede usar:

- `getSession()` en `src/lib/dal/auth.ts` es el único punto que conoce la librería o el mecanismo de sesión.
- `requireRole(...roles: Role[])` se apoya en `getSession()` y es lo que llaman las acciones y la DAL.
- La autorización (qué rol puede hacer qué, y si el recurso le corresponde) es código propio en la DAL, no de la librería.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| API REST con Route Handlers para todo | Agrega una capa (contratos, DTOs, cliente HTTP) sin ningún consumidor que la use. Las lecturas desde Server Components pasarían por un round trip HTTP innecesario, y las páginas prerenderizadas fallarían en el build. |
| Server Actions con lógica de negocio dentro | Acopla las reglas al transporte. Un futuro Route Handler tendría que duplicarlas. |
| Confiar en Proxy para autorizar | Solo debe leer la cookie (corre en cada ruta, incluso en prefetch) y no conoce los recursos. Un cambio en el `matcher` o mover una acción de ruta puede quitar la cobertura sin avisar. |

## Consecuencias

**A favor**

- Menos código y un único lenguaje de punta a punta, sin contratos duplicados.
- Las reglas de negocio se implementan una vez, en la DAL, y valen para cualquier punto de entrada.
- Los formularios funcionan con mejora progresiva (sin JS cargado).

**Restricciones que asumimos**

- **Cada acción es un endpoint POST alcanzable directamente**, no solo desde la interfaz. Por eso sesión y rol se verifican dentro de cada acción, y el cliente envía referencias (IDs) más el cambio, nunca datos de propiedad. Zod solo valida la forma, no que el recurso le pertenezca a quien lo invoca.
- **Las acciones se despachan de a una** desde el cliente. No sirven para lecturas ni para carga en paralelo.
- **El contrato es interno.** Los identificadores de las acciones cambian entre despliegues (rotan como máximo cada 14 días), y un cliente con una versión anterior abierta puede fallar con "Failed to find Server Action". No se publican como API. Un consumidor externo requiere un Route Handler con contrato versionado.
- **Lo que devuelve una acción se serializa al cliente.** Se devuelve lo que la interfaz necesita, no registros crudos de la base.
- **Concurrencia en turnos.** "Sin turnos superpuestos" no se garantiza con un chequeo previo más un insert, porque dos usuarios de mesa de entradas pueden reservar a la vez. La DAL lo hace dentro de una transacción y debería respaldarse con una restricción en la base de datos. Prisma no la declara en el schema, así que iría como SQL en la migración. Se detalla al modelar `Appointment`.

## Referencias

- Convención de acciones y plantilla de ficha: [`docs/acciones.md`](../acciones.md)
- Nombres de dominio: [`docs/glossary.md`](../glossary.md)
