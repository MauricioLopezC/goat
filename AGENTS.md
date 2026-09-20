<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Goat — gestión de turnos para un policonsultorio de traumatología

Sistema de turnos y atención ambulatoria: pacientes, agenda de profesionales, turnos por prestación, registro de la atención, cobros e indicadores. Es un proyecto académico; el profesor actúa como cliente del centro y evalúa la demo funcional y la documentación.

## Stack

Next.js (App Router) + TypeScript + Prisma 7 + PostgreSQL en Docker.

- Base de datos: `npm run db:up` (Docker Compose), `npm run db:migrate`, `npm run db:generate`. Variables en `.env` (plantilla: `.env.example`).
- Prisma 7: el cliente se genera en `src/generated/prisma` (no se commitea; correr `npm run db:generate` tras clonar). Usar siempre `import { prisma } from "@/lib/prisma"`, nunca instanciar `PrismaClient` a mano (requiere el adapter `pg`). La conexión se configura en `prisma.config.ts`, no en el schema.

## Convenciones

- Todo el código va en inglés: modelos, campos, enums, funciones, variables y rutas (ej. `Appointment`, `Patient`). La UI y la documentación quedan en español.
- Nombres de dominio: usar los de `docs/glossary.md` y consultarlo antes de crear modelos, campos o enums. No inventar sinónimos; si falta un término, agregarlo ahí en el mismo cambio.
- Contexto completo del producto (glosario, alcance, decisiones del cliente, riesgos, preguntas abiertas): `docs/contexto-goat.md`. Consultarlo ante dudas de dominio; no hace falta leerlo entero en cada sesión.

## Verificación antes de terminar

Antes de dar por terminado un feature, arreglo o cambio de código, correr `npm run check` y dejarlo en verde. Un cambio con `check` en rojo no está terminado y no se entrega ni se commitea.

`check` corre, en orden: `format:check` (Prettier), `lint` (ESLint), `typecheck` (`next typegen` + `tsc --noEmit`) y `db:validate` (`prisma validate`).

- Si falla el formato: `npm run format` lo corrige solo; volver a correr `check`.
- Si falla lint o tipos: arreglar la causa. No silenciar con `eslint-disable`, `@ts-ignore`, `@ts-expect-error` ni `any` para que pase; si de verdad no hay otra salida, decirlo explícitamente en el resumen.
- `typecheck` necesita el cliente de Prisma generado: tras clonar o cambiar `schema.prisma`, correr `npm run db:generate` primero.
- Si `check` pasa en local pero falla en el CI, sospechar de estado viejo: `tsc` es incremental y reutiliza `tsconfig.tsbuildinfo`, y los tipos de Next viven en `.next/`. Para reproducir el CI, borrar `.next/`, `tsconfig.tsbuildinfo` y `next-env.d.ts` y volver a correr `check`.
- No hay tests automatizados todavía. Cuando se agregue un runner, sumarlo a `check` y actualizar esta sección.
- Al reportar el resultado, decir qué comandos se corrieron y cuál fue el resultado real; no afirmar que pasó sin haberlo corrido.

## Ramas y Pull Requests

Guía completa en `CONTRIBUTING.md`; leerla antes de crear una rama, commitear o abrir un PR. Lo esencial:

- La rama principal es `master` y está protegida: nunca commitear ni pushear a `master`. Cada cambio va en una rama propia (`feature/HU-<n>-slug`, `fix/slug`, `docs/slug`, `chore/slug`) y entra por Pull Request.
- Commits con formato `tipo: descripción` en español (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`).
- Un PR necesita el check `check` en verde y 1 aprobación de otra persona. El agente no mergea ni aprueba, y no hace push ni abre el PR sin que se lo pidan.

## Arquitectura

Decisión completa en `docs/adr/0001-server-actions-y-capa-de-acceso-a-datos.md`; convención y catálogo de operaciones en `docs/acciones.md`. Consultarlos antes de crear una acción o tocar el acceso a datos.

- Lecturas en Server Components; mutaciones con Server Actions. Route Handlers solo para consumidores externos, no para la UI propia.
- Las reglas de negocio y el acceso a Prisma viven en `src/lib/dal/` (`server-only`). Las acciones son adaptadores finos y devuelven `ActionResult<T>`.
- Cada acción es un endpoint POST público: verificar sesión y rol dentro de ella (`proxy.ts` no alcanza) y validar la entrada con Zod.
- Zod: importar `z` de `@/lib/validation/zod`, nunca de `"zod"`, para que los mensajes salgan en español (lo impone ESLint).
- Cada operación nueva se especifica con la plantilla de ficha de `docs/acciones.md`, en el mismo cambio.

## Interfaz

- shadcn/ui (Radix, preset `nova`) + Tailwind 4. El diseño está en `docs/DESIGN.md`: consultarlo antes de crear UI. El tema (tokens) vive en `src/app/globals.css` y debe mantenerse sincronizado con ese documento.
- Usar tokens semánticos (`bg-primary`, `text-muted-foreground`, `bg-success-soft`, etc.), nunca colores hex sueltos. Solo tema claro.
- Componentes nuevos con `npx shadcn@latest add <nombre>`; al agregarlos, aplicar los ajustes de radio que indica `docs/DESIGN.md`.

## Dominio

- **Actores:** mesa de entradas (usuario más intensivo, optimizar su UX), profesional, gerente. El paciente es opcional. Control de acceso por rol en todo el sistema.
- **Turno:** reserva de la agenda de un profesional para un paciente, con una prestación (que fija duración y valor). Estados: Programado → Confirmado → Atendido, o Cancelado, o Ausente. Considera servicio, prioridad/urgencia y obra social.
- **Cobertura:** particular u obra social (plan, nº de afiliado, orden/autorización, coseguro).

## Reglas que no se negocian

- No puede haber turnos superpuestos ni fuera de la franja de atención del profesional.
- Todo turno es trazable: quién lo creó, modificó o canceló, cuándo y con qué motivo.
- Modelar prestación y duración variable desde el inicio, aunque la UI sea simple.
- Mantener separados el valor de la prestación, la cobertura y lo que paga el paciente.

## Fuera de alcance (no construir)

Historia clínica electrónica completa/PACS, liquidación de honorarios, app móvil nativa, receta electrónica con firma digital, multi-sede.
