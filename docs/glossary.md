# Glosario de nombres en código

Equivalencias entre el lenguaje del dominio (español, ver `contexto-goat.md`) y los nombres que se usan en el código (inglés): modelos, campos, enums, funciones, rutas.

**Reglas**

- Usar siempre el nombre de la columna "En código". No inventar sinónimos (`Booking`, `Doctor`, `Procedure`, etc.).
- Si falta un término, agregarlo acá en el mismo commit que lo introduce en el código.
- La UI y la documentación se mantienen en español.

## Entidades

| Español | En código | Nota |
|---|---|---|
| Paciente | `Patient` | |
| Profesional | `Professional` | No `Doctor`: incluye kinesiólogos. |
| Turno | `Appointment` | |
| Horario disponible | `AvailableSlot` | Bloque calculado desde una franja, con la duración del servicio, sin ausencias, feriados ni turnos superpuestos. No es una entidad persistida. |
| Calendario del centro | `/calendar` | Turnos y bloques libres de todos los profesionales, por día o semana, para gerente y mesa de entradas ([HU-11](hu/HU-11-calendario-del-centro.md)). |
| Bloque libre | `FreeBlock` | Tramo de una franja sin feriado, ausencia ni turno Programado o Completado. Se muestra en el calendario del centro; con un servicio elegido se divide como un `AvailableSlot`. No es una entidad persistida. |
| Agenda propia de turnos | `/agenda` | El profesional consulta exclusivamente sus turnos. Distinta de `/my-schedule`, que muestra sus franjas. |
| Prestación | `Service` | Lo que se hace en el turno; determina duración y valor. |
| Área / línea de atención | `Specialty` | Columna, Rodilla, Hombro, etc. No confundir con la prestación. |
| Franja de atención | `AvailabilityWindow` | Horario en que un profesional atiende un día determinado. |
| Sobreturno | `Overbooking` | Pendiente de la pregunta abierta 2 al cliente. |
| Obra social | `HealthInsurer` | |
| Plan | `InsurancePlan` | |
| Afiliación del paciente | `Coverage` | Plan más número de afiliado. |
| Coseguro | `Copay` | Lo que paga el paciente aunque tenga cobertura. |
| Atención registrada | `Encounter` | Lo efectivamente realizado en un turno. Base del historial. |
| Prescripción | `Prescription` | |
| Pago | `Payment` | |
| Medio de pago | `PaymentMethod` | |
| Usuario | `User` | Cuenta con la que se ingresa al sistema. Lleva el `Role`. |
| Título profesional | `ProfessionalTitle` | Traumatólogo, kinesiólogo. Un `Professional` puede tener más de uno. No confundir con `Specialty` (área) ni con `Service` (prestación). |
| Horarios de atención | `schedule` | Franjas y excepciones de agenda de un profesional, juntas ([HU-05](hu/HU-05-franjas-de-atencion.md)). Es el nombre de la pantalla (`/professionals/[id]/schedule`, y `/my-schedule` para el propio profesional). No confundir con la agenda del profesional ([HU-12](hu/HU-12-agenda-del-profesional.md)), que son sus turnos. |
| Excepción de agenda | `AvailabilityException` | Día u horario en que el profesional no atiende, contra su patrón de `AvailabilityWindow`. |
| Consultorio / box | `Room` | En el Incremento 1 cada profesional tiene el suyo. |
| Feriado | `Holiday` | Día en que el centro permanece cerrado. No genera disponibilidad para nadie. |
| Traza de cambios de un turno | `AppointmentEvent` | Qué cambió en un turno ya creado, quién, cuándo y por qué. El alta no genera evento: su autoría vive en `Appointment.createdById`. |
| Traza de cambios de un profesional | `ProfessionalEvent` | Edición, baja o reactivación con autor, fecha y motivo. |

## Enums

**Estado del turno** (`AppointmentStatus`): `SCHEDULED` (Programado) → `COMPLETED` (Completado), o `CANCELLED` (Cancelado), o `EXPIRED` (Vencido). Se usa `CANCELLED` (grafía británica) en todo el código.

- `SCHEDULED` es el único estado desde el que se puede transicionar: los otros tres son finales.
- `EXPIRED` es el turno cuya hora pasó sin que se registrara la atención. En el Incremento 1 lo marca el usuario desde el detalle del turno; no hay proceso automático.
- No existen `CONFIRMED` ni `NO_SHOW`: el equipo los reemplazó por este juego de cuatro estados.

**Rol** (`Role`): `RECEPTIONIST` (mesa de entradas), `PROFESSIONAL`, `MANAGER` (gerente), `PATIENT` (opcional).

**Tipo de documento** (`DocumentType`): `DNI`, `LC`, `LE`, `CI`, `PASSPORT`. Junto con el número forma la identificación única de un `Patient` y de un `Professional`.

**Género** (`Gender`): `MALE`, `FEMALE`, `OTHER`.

**Tipo de cobertura** (`CoverageType`): `PRIVATE` (particular) o `HEALTH_INSURANCE` (obra social). Cuando es `HEALTH_INSURANCE`, el paciente tiene además una `Coverage`.

**Día de la semana** (`Weekday`): `MONDAY` a `SUNDAY`. Es el día del patrón semanal de una `AvailabilityWindow`, no una fecha.

**Tipo de cambio en un turno** (`AppointmentEventType`): `UPDATED`, `CANCELLED`, `COMPLETED`, `EXPIRED`.

**Tipo de cambio en un profesional** (`ProfessionalEventType`): `UPDATED`, `DEACTIVATED`, `REACTIVATED`.

**Alta y baja** (activo/inactivo): campo `active` de tipo booleano, con el mismo nombre en `User`, `Patient`, `Professional` y `Service`. La baja siempre es lógica: no se borra el registro.

## Sin nombre todavía

Definir antes de modelarlos: tipo de turno (primera consulta, control, post-quirúrgico, práctica, kinesiología, urgencia), prioridad/urgencia, series o packs de kinesiología.
