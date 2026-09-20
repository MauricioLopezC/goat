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
