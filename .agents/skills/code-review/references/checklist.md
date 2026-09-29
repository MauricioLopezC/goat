# Checklist Rápido de Code Review

Guía condensada para evaluar un diff o pull request en GOAT.

---

## 1. Alcance y HU
- [ ] ¿El cambio responde estrictamente a la HU asignada o al objetivo del bugfix?
- [ ] ¿Hay scope creep (cambios ajenos o innecesarios mezclados en el PR)?
- [ ] ¿Si es una HU, se verificaron todos los puntos de *Validaciones*, *Comportamiento* y *Permisos*?

## 2. Convenciones de Idioma y Dominio
- [ ] Código (variables, funciones, modelos, rutas) exclusivamente en **inglés**.
- [ ] Interfaz de usuario (etiquetas, botones, errores, modales) exclusivamente en **español**.
- [ ] Nombres de dominio alineados con [`docs/glossary.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/glossary.md).
- [ ] Términos nuevos agregados al glosario.

## 3. Acceso a Datos y Seguridad (DAL)
- [ ] `import "server-only"` presente en todo archivo de `src/lib/dal/`.
- [ ] Las páginas y Server Actions NO importan `prisma` directamente; solo la DAL accede a la BD.
- [ ] Toda función DAL recibe `actor: Actor` como último parámetro.
- [ ] La DAL ejecuta `assertRole(actor, ...)` antes de operar.
- [ ] La DAL verifica pertenencia/tenancy de recursos sensibles (ej. profesional editando su propio turno).
- [ ] No se saltan validaciones de negocio en la DAL.

## 4. Server Actions y Zod
- [ ] Server Action envuelta con `defineAction` o con verificación explícita de `requireRole`.
- [ ] Esquema Zod importado de `@/lib/validation/zod` (¡nunca `"zod"` directo!).
- [ ] La acción retorna `ActionResult<T>` consistente.
- [ ] `revalidatePath` o `revalidateTag` se llama antes de cualquier `redirect()`.
- [ ] Mensajes de error al usuario son claros y en español.

## 5. Next.js App Router & React
- [ ] Páginas (`page.tsx`) y layouts (`layout.tsx`) son Server Components (sin `"use client"` innecesario).
- [ ] `"use client"` únicamente en componentes hoja interactivos.
- [ ] Cargas de datos asíncronas no bloqueantes en paralelo (`Promise.all`) cuando no hay dependencia entre ellas.
- [ ] Sin fugas de secretos o campos sensibles del servidor hacia el cliente.
- [ ] Permisos de ruta: `requirePageRole` sincronizado con `src/lib/route-access.ts` y `src/lib/navigation.ts`.

## 6. Base de Datos y Modelo
- [ ] Si se cambió `schema.prisma`:
  - [ ] Migración generada y commiteada en `prisma/migrations/`.
  - [ ] [`docs/modelo-de-datos.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/modelo-de-datos.md) actualizado con el diagrama y reglas.
- [ ] Cliente Prisma importado como `import { prisma } from "@/lib/prisma"`.

## 7. UI y Diseño (shadcn/ui + Tailwind 4)
- [ ] Componentes de shadcn/ui reutilizados desde `@/components/ui/*`.
- [ ] Sin colores hex hardcodeados (usar tokens semánticos: `bg-primary`, `text-muted-foreground`, etc.).
- [ ] Sin tema oscuro (solo tema claro).
- [ ] Contenedor principal limitado a `max-w-6xl` (salvo calendario que usa `data-layout="wide"`).

## 8. Documentación
- [ ] Si se modificó o agregó una acción: ficha actualizada en [`docs/acciones.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/acciones.md).
- [ ] Título de commit / PR con formato `tipo: descripción` en español.

## 9. Calidad y Verificación
- [ ] `npm run check` corre y queda en verde.
- [ ] Sin `eslint-disable`, `@ts-ignore`, `@ts-expect-error` o `any` introducidos para esquivar el typechecker.
