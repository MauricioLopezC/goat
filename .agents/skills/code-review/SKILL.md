---
name: code-review
description: >-
  Realiza una revisión de código exhaustiva para features, fixes, ramas y PRs en Goat y proyectos Next.js.
  Evalúa los cambios contra los criterios de aceptación de las historias de usuario (docs/hu/), las reglas de arquitectura y convenciones del proyecto (AGENTS.md, docs/acciones.md, docs/adr/, docs/modelo-de-datos.md, glossary.md) y las buenas prácticas de Next.js App Router, generando un reporte estructurado y procesable.
  Se activa ante: "code review", "revisar código", "hacer review", "review del PR", "review de la rama", "revisar cambios", "revisar feature", "reporte de review", "review".
---

# Code Review — Goat & Next.js

Esta skill define el procedimiento paso a paso para realizar una revisión de código integral en el proyecto Goat, evaluando fidelidad a la historia de usuario, arquitectura del proyecto, calidad de código Next.js y verificación técnica, culminando en un reporte estructurado.

---

## 1. Identificación del Alcance y Contexto

Antes de emitir juicio sobre el código:

1. **Detectar la rama y cambios:**
   - Inspeccionar la rama actual con `git status` y `git branch --show-current`.
   - Listar commits o archivos modificados respecto a `master`:
     ```bash
     git diff --stat origin/master...HEAD
     # o si se evalúa el working tree:
     git status --short
     git diff
     ```
2. **Identificar la Historia de Usuario (HU) o Alcance:**
   - Si el nombre de la rama contiene `HU-XX` (ej. `feature/HU-08-buscar-modificar-paciente`), o el commit / PR lo referencia:
     - Localizar y leer el archivo correspondiente en [`docs/hu/HU-XX-*.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/hu/).
     - Revisar también los ajustes de incrementos aplicables en [`docs/incrementos/`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/incrementos/) (por ejemplo, si hubo cambios en los criterios de la HU en el incremento 2).
   - Si es un `fix`, `chore` o `refactor` sin HU propia:
     - Identificar qué componente, contrato o regla de negocio corrige.
     - Determinar si afecta el comportamiento de alguna HU existente y verificar contra esa HU.

---

## 2. Ejes de Evaluación Obligatorios

La revisión debe contrastar el código contra cuatro pilares fundamentales:

### Pilar 1: Criterios de Aceptación de la Historia (HU)

Si el cambio corresponde a una historia (o modifica el alcance de una):

- [ ] **Datos:**
  - ¿Se manejan todos los campos obligatorios y opcionales definidos en la HU?
  - ¿Se respetan los campos expresamente excluidos del incremento?
- [ ] **Validaciones:**
  - ¿Se cumplen todas las reglas de validación de negocio (formatos, unicidad, longitudes, restricciones de edición)?
  - ¿Las validaciones ocurren tanto en el cliente/formulario como en el backend/DAL?
- [ ] **Comportamiento:**
  - ¿Los flujos cumplen lo especificado (estados vacíos, ordenamiento por defecto, paginación, feedback al usuario)?
  - ¿Se registra trazabilidad y auditoría cuando la HU lo exige (quién, cuándo, qué cambió)?
- [ ] **Confirmación:**
  - En acciones destructivas, altas o bajas, ¿se solicita confirmación clara según la HU?
- [ ] **Permisos:**
  - ¿Se respeta estrictamente la matriz de roles (`MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`)?
  - ¿Se bloquea tanto a nivel de UI (ocultar controles) como a nivel de Server Action y DAL (barrera infranqueable)?
- [ ] **Operaciones:**
  - ¿Las operaciones coinciden con las especificadas en la sección *Operaciones* de la HU?
- [ ] **Definition of Done ([`docs/hu/README.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/hu/README.md)):**
  - Criterios funcionando, permisos verificados con los 3 usuarios de prueba, `check` en verde, documentación actualizada.

---

### Pilar 2: Reglas del Proyecto y Arquitectura

Consultar [`AGENTS.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/AGENTS.md), [`docs/acciones.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/acciones.md) y [`docs/adr/`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/adr/):

- [ ] **Convención de Idioma:**
  - Código en **inglés**: nombres de modelos, campos, enums, funciones, variables, archivos y rutas (ej. `appointments`, `Patient`, `isPending`).
  - UI y documentación en **español**: etiquetas, mensajes de error, tooltips, modales y textos visibles.
- [ ] **Nombres de Dominio y Glosario:**
  - Los nombres deben coincidir con [`docs/glossary.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/glossary.md).
  - Si se agregó un concepto nuevo, debe estar registrado en el glosario en el mismo cambio.
- [ ] **Arquitectura DAL y Server Actions (ADR-0001):**
  - **Lecturas:** en Server Components.
  - **Mutaciones:** únicamente con Server Actions (nunca Route Handlers para UI interna).
  - **Ubicación de reglas de negocio:** en `src/lib/dal/` con `import "server-only"`.
  - **Autorización en la DAL:** toda función DAL recibe el `actor` como último argumento y verifica rol (`assertRole`) y pertenencia de recursos.
  - **Acciones como adaptadores finos:** validan sesión (`requireRole`), validan schema con Zod, llaman a la DAL pasando el `actor`, y devuelven `ActionResult<T>`.
  - **Zod:** importar `z` SIEMPRE de `@/lib/validation/zod` (nunca `"zod"` directo), para asegurar mensajes en español.
  - **Revalidación:** `revalidatePath` / `revalidateTag` debe ejecutarse **antes** de cualquier `redirect()`.
- [ ] **Permisos de Rutas y Navegación:**
  - El `requirePageRole` de la página debe ser idéntico a la regla en `src/lib/route-access.ts`.
  - Si la página figura en el menú, debe declararse en `src/lib/navigation.ts` con los mismos roles permitidos.
- [ ] **Base de Datos y Prisma (Prisma 7):**
  - Importar siempre `import { prisma } from "@/lib/prisma"`, nunca instanciar `PrismaClient` a mano.
  - Si se modifica `prisma/schema.prisma`: debe existir la migración correspondiente (`prisma/migrations/`) y actualizarse [`docs/modelo-de-datos.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/modelo-de-datos.md) (diagrama ER y tablas de reglas).
- [ ] **Documentación de Acciones:**
  - Si se creó o modificó una operación, debe existir su ficha en [`docs/acciones.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/acciones.md).
- [ ] **Interfaz y Diseño ([`docs/DESIGN.md`](file:///home/mauro/orca/workspaces/goat/fix-impedir-modificar-el-documento-de-un-pacient/docs/DESIGN.md)):**
  - Utilizar componentes primitivos de shadcn/ui (`@/components/ui/*`). No crear primitivos propios si shadcn los ofrece.
  - Usar tokens semánticos de Tailwind (`bg-primary`, `text-muted-foreground`, `bg-destructive`, etc.). **Nunca colores hex o utilidades de color sueltas** (ej. `bg-red-500`, `#1a2b3c`).
  - Solo tema claro.
  - Ancho de layout: contenedor limitado a `max-w-6xl`. Si requiere ancho completo (calendario), usar `data-layout="wide"` en el contenedor raíz.
- [ ] **Reglas Innegociables del Dominio:**
  - Sin turnos superpuestos ni fuera de la franja de atención.
  - Trazabilidad completa: quién creó, modificó o canceló, cuándo y motivo.
  - Separación entre valor de prestación, cobertura y monto que paga el paciente.

---

### Pilar 3: Buenas Prácticas de Next.js (App Router)

- [ ] **Server Components por defecto:**
  - Las páginas y layouts deben ser Server Components.
  - `"use client"` únicamente en componentes hoja que realmente requieran interactividad (hooks `useState`, `useEffect`, eventos de usuario).
- [ ] **Prevención de Fugas de Información (Security / Sensitive Data):**
  - No exponer campos internos (hashes, tokens, flags privados) en props enviadas a Client Components.
- [ ] **Eficiencia y Waterfalls:**
  - Consultas independientes en paralelo mediante `Promise.all([ ... ])`.
- [ ] **Manejo de Formularios y Estado:**
  - Uso correcto de `useActionState`, transiciones de React (`useTransition`), o formularios controlados con feedback de carga y error.
  - Mensajes de error amigables en español derivados de `ActionResult`.

---

### Pilar 4: Verificación Técnica Automática

- [ ] Ejecutar la suite completa de calidad:
  ```bash
  npm run check
  ```
  *(Verifica en orden: `format:check`, `lint`, `typecheck`, `db:validate`, `test`)*.
- [ ] **Tolerancia cero a silenciamientos:**
  - No permitir `eslint-disable`, `@ts-ignore`, `@ts-expect-error` ni tipos `any` introducidos para esquivar errores.
- [ ] Si se cambiaron modelos de Prisma, verificar que `npm run db:generate` se haya ejecutado.

---

## 3. Estructura del Reporte de Code Review

Todo informe de revisión generado por esta skill debe seguir esta estructura (consultar plantilla detallada en [`references/report-template.md`](./references/report-template.md)):

1. **Encabezado y Resumen Ejecutivo:**
   - Rama / PR evaluado.
   - Historia de usuario o propósito del cambio.
   - Veredicto general:
     - 🟢 **APROBADO**: Cumple todos los criterios, reglas y verificación sin objeciones.
     - 🟡 **APROBADO CON OBSERVACIONES**: Cumple la HU y el check pasa, pero hay mejoras o advertencias menores no bloqueantes.
     - 🔴 **REQUIERE CAMBIOS**: Falla criterios de aceptación, rompe reglas de arquitectura/permisos, o `npm run check` falla.
2. **Matriz de Criterios de Aceptación (HU):**
   - Tabla con cada criterio especificado en la HU y su estado: `✅ Cumplido` | `⚠️ Parcial` | `❌ No cumplido` | `➖ No aplica`.
3. **Cumplimiento de Reglas del Proyecto:**
   - Evaluación sintética de: Idioma (EN en código / ES en UI), DAL & Server Actions, Permisos en DAL y páginas, Zod en `@/lib/validation/zod`, Tokens de UI (shadcn / no hex), Documentación sincronizada (`acciones.md`, `glossary.md`, `modelo-de-datos.md`).
4. **Buenas Prácticas Next.js & React:**
   - Server vs Client components, manejo de datos y revalidación.
5. **Estado de Verificación Técnica:**
   - Resultado real de los comandos ejecutados (`npm run check`, tests unitarios / DB).
6. **Hallazgos Detallados (Action Items):**
   - 🔴 **Bloqueantes (Must fix)**: Violaciones de HU, fallas de seguridad/permisos, errores de tipos/tests.
   - 🟡 **Advertencias (Should fix)**: Inconsistencias de diseño, tokens incorrectos, deuda técnica.
   - 🟢 **Sugerencias (Nice to have)**: Refactorings, legibilidad, optimizaciones.
7. **Recomendación Final / Próximos Pasos.**

---

## 4. Archivos de Referencia

- [Plantilla de Reporte](./references/report-template.md): Formato estándar en Markdown para la entrega del review.
- [Checklist Rápido](./references/checklist.md): Guía de chequeo condensada para inspección rápida de código.
