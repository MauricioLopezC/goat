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

## Enums

**Estado del turno** (`AppointmentStatus`): `SCHEDULED` → `CONFIRMED` → `ATTENDED`, o `CANCELLED`, o `NO_SHOW`. Se usa `CANCELLED` (grafía británica) en todo el código.

**Rol** (`Role`): `RECEPTIONIST` (mesa de entradas), `PROFESSIONAL`, `MANAGER` (gerente), `PATIENT` (opcional).

## Sin nombre todavía

Definir antes de modelarlos: tipo de turno (primera consulta, control, post-quirúrgico, práctica, kinesiología, urgencia), prioridad/urgencia, series o packs de kinesiología, auditoría de cambios.
