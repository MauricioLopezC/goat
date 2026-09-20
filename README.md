# Goat

Sistema de gestión de turnos y atención ambulatoria para un policonsultorio de traumatología.

Permite registrar pacientes, administrar la agenda de los profesionales, dar y reprogramar turnos por prestación, registrar la atención y los cobros, y medir cómo funciona el centro. Es un proyecto académico: el profesor actúa como cliente del centro y evalúa la demo funcional y la documentación.

## Qué resuelve

Hoy el centro lleva la agenda en papel o planillas, y eso produce turnos superpuestos, pacientes sin registro de su obra social, ausentismo que nadie mide, cobros sin trazabilidad y un gerente sin información para decidir. Goat busca ser la **única fuente de verdad de la agenda** y dar **trazabilidad de cada turno**: quién lo dio, quién lo modificó o canceló, cuándo y con qué motivo.

## A quién sirve

| Actor                 | Qué hace en el sistema                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| **Mesa de entradas**  | Registra pacientes, da, modifica y cancela turnos, ve la agenda del día y cobra. Es el usuario más intensivo: su experiencia es la prioridad. |
| **Profesional**       | Ve su agenda y el historial del paciente, y registra la atención.                 |
| **Gerente**           | Controla ocupación, ausentismo e ingresos, y administra profesionales y servicios. |
| **Paciente**          | Opcional: sacar o cancelar su turno por sí mismo.                                 |

El acceso se controla por rol en todo el sistema.

## Qué incluye

Gestión de pacientes, de profesionales, de servicios y prestaciones, y de turnos; calendario; atención e historial; pagos con varios medios de pago; e indicadores para profesionales y gerencia. Transversales: auditoría y control de acceso por rol.

Un **turno** reserva la agenda de un profesional para un paciente con una prestación, que fija su duración y su valor. Pasa por los estados Programado → Confirmado → Atendido, o termina Cancelado o Ausente. La cobertura puede ser particular u obra social.

**Reglas que no se negocian**

- No puede haber turnos superpuestos ni fuera de la franja de atención del profesional.
- Todo turno es trazable.
- Prestación y duración variable están modeladas desde el inicio.
- Se mantienen separados el valor de la prestación, la cobertura y lo que paga el paciente.

**Fuera de alcance:** historia clínica electrónica completa o PACS, facturación electrónica, liquidación de honorarios, stock e insumos, telemedicina, app móvil nativa, receta electrónica con firma digital y multi-sede.

## Stack

Next.js (App Router) y TypeScript, Prisma 7 sobre PostgreSQL (en Docker), shadcn/ui con Tailwind 4 para la interfaz, y Zod para validar entradas.

## Puesta en marcha

### Requisitos

- Node.js 20.9 o superior (el CI usa la 22) y npm.
- Docker con Docker Compose, para la base de datos.
- Git.

### Pasos

```bash
git clone https://github.com/MauricioLopezC/goat.git
cd goat

npm ci                    # instala las dependencias
cp .env.example .env      # crea tu configuración local
npm run db:up             # levanta PostgreSQL en Docker
npm run db:generate       # genera el cliente de Prisma (no se commitea)
npm run db:migrate        # aplica las migraciones
npm run dev               # servidor de desarrollo
```

Con eso la aplicación queda en <http://localhost:3000>.

El archivo `.env` no se commitea. Para desarrollo local alcanza con copiar `.env.example`; si cambiás las credenciales o el puerto de Postgres, mantené `DATABASE_URL` coherente con `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` y `POSTGRES_PORT`.

Las migraciones se aplican con `db:migrate`, pero todavía no hay modelos: el comando informa que todo está en sincronía.

### Comandos útiles

| Comando                | Qué hace                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo                                                 |
| `npm run build`        | Build de producción                                                    |
| `npm run check`        | Formato, lint, tipos y validación del schema. Correrlo antes de un PR  |
| `npm run format`       | Corrige el formato con Prettier                                        |
| `npm run db:up`        | Levanta la base de datos                                               |
| `npm run db:down`      | Detiene la base de datos (los datos se conservan)                      |
| `npm run db:migrate`   | Aplica y crea migraciones                                              |
| `npm run db:generate`  | Regenera el cliente de Prisma                                          |
| `npm run db:studio`    | Abre Prisma Studio para explorar los datos                             |

### Problemas frecuentes

- **`Cannot find module '@/generated/prisma/client'`:** falta generar el cliente. Correr `npm run db:generate`, también después de cada cambio en `prisma/schema.prisma`.
- **`Another next dev server is already running`:** ya hay un servidor de desarrollo en este proyecto. Usar el que está corriendo o detenerlo.
- **No conecta con la base de datos:** verificar que el contenedor esté sano con `docker ps` y que `DATABASE_URL` coincida con los valores de `.env`.
- **Puerto 5432 ocupado:** cambiar `POSTGRES_PORT` en `.env` y el puerto dentro de `DATABASE_URL`.

## Documentación

| Documento                                                                                    | Contenido                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`docs/contexto-goat.md`](docs/contexto-goat.md)                                             | Contexto completo del producto: alcance, decisiones del cliente, riesgos y preguntas abiertas |
| [`docs/glossary.md`](docs/glossary.md)                                                       | Nombres de dominio en código (inglés) y su equivalente en español  |
| [`docs/acciones.md`](docs/acciones.md)                                                       | Convención y catálogo de operaciones (Server Actions)              |
| [`docs/adr/`](docs/adr)                                                                      | Decisiones de arquitectura                                         |
| [`docs/DESIGN.md`](docs/DESIGN.md)                                                           | Sistema de diseño de la interfaz                                   |
| [`AGENTS.md`](AGENTS.md)                                                                     | Convenciones de código y reglas para agentes de IA                 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                                                         | Ramas, commits y Pull Requests                                     |

## Cómo contribuir

Nadie pushea directo a `master`: cada cambio va en una rama propia y entra por Pull Request, con el CI en verde y al menos una aprobación. Leer [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de empezar.
