# Modelo de datos (DER)

Diagrama entidad-relación del schema vigente (Incrementos 1 y 2). La fuente de verdad es [`prisma/schema.prisma`](../prisma/schema.prisma) y la migración a mano de `prisma/migrations/`: este documento es un mapa para entenderlas, no las reemplaza. Si discrepan, gana el schema y se corrige este documento.

Los nombres son los de [`glossary.md`](glossary.md). El diagrama muestra claves y los campos que definen a cada entidad; la lista completa de campos está en el schema.

## Diagrama

```mermaid
erDiagram
    User |o--o| Professional : "cuenta de acceso"
    User ||--o{ Appointment : "crea"
    User ||--o{ AppointmentEvent : "registra"
    User ||--o{ ProfessionalEvent : "registra"
    User ||--o{ Holiday : "carga"
    User ||--o{ Payment : "cobra y anula"

    Professional }o--o{ ProfessionalTitle : "tiene"
    Professional }o--o{ Service : "presta"
    Professional ||--o{ AvailabilityWindow : "atiende en"
    Professional ||--o{ AvailabilityException : "se ausenta"
    Professional ||--o{ Appointment : "atiende"
    Professional ||--o{ ProfessionalEvent : "registra cambios"

    Specialty |o--o{ Service : "agrupa"
    Service }o--o{ AvailabilityWindow : "habilitado en"
    Service ||--o{ Appointment : "se presta en"

    Room |o--o{ AvailabilityWindow : "aloja"

    Patient ||--o{ Appointment : "reserva"
    Patient ||--o| Coverage : "tiene"
    InsurancePlan ||--o{ Coverage : "cubre"
    HealthInsurer ||--o{ InsurancePlan : "ofrece"

    Appointment ||--o{ AppointmentEvent : "registra cambios"
    Appointment ||--o{ Payment : "se cobra"
    PaymentMethod ||--o{ Payment : "se paga con"
    Professional |o--o{ AppointmentEvent : "antes y después de reprogramar"

    User {
        int id PK
        string email UK "identificador de ingreso"
        string passwordHash "argon2id"
        Role role
        boolean active
    }

    Professional {
        int id PK
        int userId FK "opcional, único"
        string documentNumber "único con documentType"
        string licenseNumber UK "matrícula"
        boolean active
        datetime deactivatedAt "baja lógica"
        string deactivationReason
    }

    ProfessionalTitle {
        int id PK
        string name UK
    }

    ProfessionalEvent {
        int id PK
        int professionalId FK
        int userId FK
        ProfessionalEventType type
        string reason
        json changes
        timestamptz createdAt
    }

    Specialty {
        int id PK
        string name UK
    }

    Service {
        int id PK
        string name UK
        int specialtyId FK "opcional"
        int durationMinutes "fija el bloque de agenda"
        decimal price "valor de la prestación"
        boolean requiresReferral
    }

    Room {
        int id PK
        string name UK
    }

    AvailabilityWindow {
        int id PK
        int professionalId FK
        int roomId FK "opcional"
        Weekday weekday
        int startMinute "desde la medianoche"
        int endMinute
    }

    AvailabilityException {
        int id PK
        int professionalId FK
        date date
        int startMinute "nulo = día entero"
        int endMinute
        string reason
    }

    Holiday {
        int id PK
        date date UK
        string description
        int createdById FK
        timestamptz createdAt
    }

    Patient {
        int id PK
        string documentNumber "único con documentType"
        string lastName
        string firstName
        date birthDate
        CoverageType coverageType
        string address "opcional"
        string emergencyContactName "junto con el teléfono"
        string emergencyContactPhone
        boolean active
    }

    HealthInsurer {
        int id PK
        string name UK
    }

    InsurancePlan {
        int id PK
        int healthInsurerId FK
        string name "único por obra social"
    }

    Coverage {
        int id PK
        int patientId FK "único: uno por paciente"
        int insurancePlanId FK
        string memberNumber "nº de afiliado"
    }

    Appointment {
        int id PK
        int patientId FK
        int professionalId FK
        int serviceId FK
        int createdById FK
        timestamptz startsAt
        timestamptz endsAt "startsAt + duración"
        AppointmentStatus status
        AppointmentPriority priority "URGENT exige motivo"
        string priorityReason
        string authorizationNumber "orden de la obra social"
        int authorizedById FK "junto con authorizedAt"
    }

    AppointmentEvent {
        int id PK
        int appointmentId FK
        int userId FK
        AppointmentEventType type
        string reason "obligatorio al cancelar"
        string requestedBy
        timestamptz previousStartsAt "solo en RESCHEDULED"
        int previousProfessionalId FK
        timestamptz newStartsAt
        int newProfessionalId FK
        AppointmentPriority previousPriority "solo en PRIORITY_CHANGED"
        AppointmentPriority newPriority
        timestamptz createdAt
    }

    PaymentMethod {
        int id PK
        string name UK
        boolean active
    }

    Payment {
        int id PK
        int appointmentId FK "un solo PAID por turno"
        int paymentMethodId FK
        decimal amount "monto del momento"
        PaymentStatus status
        int createdById FK
        timestamptz createdAt
        int voidedById FK "anulación: con voidedAt y voidReason"
    }
```

**Cómo leerlo.** `||` es "uno y solo uno", `|o` es "cero o uno", `o{` es "cero o muchos". `PK` es clave primaria, `FK` clave foránea y `UK` valor único. `Holiday` no se relaciona con ninguna entidad: el centro cierra ese día para todos y la DAL lo consulta por fecha.

## Grupos de entidades

| Grupo | Entidades | Qué resuelve |
|---|---|---|
| Acceso | `User` | Cuenta, rol y credencial (HU-01). Se ingresa con email y contraseña; la sesión no se persiste ([ADR 0002](adr/0002-autenticacion-y-sesion.md)). |
| Profesionales | `Professional`, `ProfessionalTitle`, `ProfessionalEvent` | Ficha, títulos e historial de cambios del profesional (HU-02 a HU-04). |
| Catálogo | `Service`, `Specialty` | Qué se hace en un turno, cuánto dura y cuánto vale (HU-06). |
| Agenda | `AvailabilityWindow`, `AvailabilityException`, `Holiday`, `Room` | Cuándo y dónde atiende cada profesional, y cuándo el centro no atiende (HU-05). |
| Pacientes y cobertura | `Patient`, `Coverage`, `InsurancePlan`, `HealthInsurer` | Quién es el paciente y cómo se cubre (HU-07, HU-08). |
| Turnos | `Appointment`, `AppointmentEvent` | La reserva, su prioridad y su traza de cambios (HU-09, HU-10, HU-16, HU-19; se consultan en HU-11, HU-12 y HU-18). |
| Cobros | `Payment`, `PaymentMethod` | Qué se cobró de cada turno, con qué medio y quién, y su anulación (HU-20, HU-21). |

## Relaciones que conviene explicar

- **`User` – `Professional` es opcional y 1 a 1.** No todo usuario atiende (mesa de entradas, gerente) y no todo profesional necesita cuenta. Cuando la tiene, es la que usa en HU-12 para ver su agenda.
- **`Coverage` solo existe con obra social.** Un `Patient` con `coverageType = PRIVATE` no tiene `Coverage`; con `HEALTH_INSURANCE` tiene exactamente una. Que las dos cosas coincidan lo debe verificar la DAL, no la base.
- **Valor, cobertura y pago están en entidades distintas.** El valor de la prestación vive en `Service.price`, la cobertura en `Coverage` y lo que pagó el paciente en `Payment.amount`, que guarda el monto del momento: si después cambia el valor del servicio, el cobro no cambia. `Appointment` no guarda importes. El coseguro salió del schema en el Inc. 2 y se modela en el Inc. 3.
- **Un cobro no se borra ni se edita.** Si se cargó mal se anula (`VOIDED`, con quién, cuándo y motivo) y el turno se vuelve a cobrar con una fila nueva. Un turno puede tener varios cobros anulados, pero a lo sumo uno `PAID`. *Pendiente de cobro* es no tener un cobro `PAID`; no es un estado persistido.
- **La autorización de la obra social vive en el turno.** `authorizationNumber`, `authorizedAt` y `authorizedById` son del `Appointment`, porque la orden se pide por turno y hay a lo sumo una.
- **Las relaciones muchos a muchos** las resuelve Prisma con tablas implícitas: `_ProfessionalToProfessionalTitle`, `_ProfessionalToService` y `_AvailabilityWindowToService`. No tienen atributos propios, por eso no aparecen como entidades. Una `AvailabilityWindow` sin servicios asignados habilita todos los que presta el profesional.
- **`Appointment` no tiene relación con la franja ni con el consultorio.** Que el turno caiga dentro de una `AvailabilityWindow` se verifica al crearlo, con la disponibilidad vigente; el turno guarda solo su `startsAt` y `endsAt`.
- **Auditoría.** Se dibujan las relaciones de `User` con `Appointment`, `AppointmentEvent`, `ProfessionalEvent`, `Holiday` y `Payment`. Las demás referencias a `User` son campos de autoría: `createdById` en `Professional`, `Patient` y `AvailabilityException`; `updatedById` en `Professional` y `Patient`; `deactivatedById` en `Professional`; y `authorizedById` en `Appointment`.
- **Trazabilidad del profesional.** El alta conserva `createdById` y `createdAt`; cada edición, baja y reactivación crea un `ProfessionalEvent` con autor, instante y motivo. La edición también registra los valores anteriores y nuevos.
- **Trazabilidad del turno.** El alta se registra en `Appointment.createdById` y `createdAt`. Todo cambio posterior (`UPDATED`, `CANCELLED`, `COMPLETED`, `EXPIRED`, `RESCHEDULED`, `PRIORITY_CHANGED`) agrega un `AppointmentEvent` con quién, cuándo, tipo y motivo. Los eventos se borran en cascada con el turno, pero un turno cancelado no se borra (HU-10).
- **Reprogramar no crea otro turno.** Se actualizan `startsAt`, `endsAt` y `professionalId` del mismo `Appointment`, y el evento `RESCHEDULED` guarda el horario y el profesional anteriores y nuevos, con FK a `Professional` (HU-16). El cambio de prioridad deja `PRIORITY_CHANGED` con la prioridad anterior y la nueva (HU-19). Así el historial (HU-18) se arma solo con los eventos.
- **Bajas lógicas.** Se usa `active` (más `deactivatedAt` en `Professional`) y nunca se borra el registro, para no perder la historia de los turnos.

## Reglas que garantiza la base de datos

Prisma no las declara, así que están escritas a mano en las migraciones `20260921194607_modelo_inicial` e `20260928120000_incremento_2` de `prisma/migrations/`. Son la garantía real de la regla "no hay turnos superpuestos": se cumplen aunque dos usuarios reserven a la vez (ver [ADR 0001](adr/0001-server-actions-y-capa-de-acceso-a-datos.md), "Concurrencia en turnos").

| Restricción | Regla |
|---|---|
| `Appointment_professional_no_overlap` | Un profesional no puede tener dos turnos cuyos intervalos se pisen. Cuentan los turnos `SCHEDULED` y `COMPLETED`; los cancelados y vencidos liberan el horario. |
| `Appointment_patient_no_overlap` | Lo mismo para un paciente (HU-09). |
| `Appointment_ends_after_start` | `endsAt` es posterior a `startsAt`. |
| `AvailabilityWindow_no_overlap` | Un profesional no puede tener dos franjas que se pisen el mismo día (HU-05). |
| `AvailabilityWindow_minutes_valid` | La franja va de 0 a 1440 minutos y empieza antes de terminar. |
| `AvailabilityException_minutes_valid` | Los dos minutos de una excepción van juntos: ambos nulos significa el día entero. |
| `Service_duration_positive` | La duración de una prestación es mayor que cero. |
| `Service_price_not_negative` | El valor de una prestación no es negativo. |
| `Payment_one_paid_per_appointment` | Índice único parcial: un turno tiene como máximo un cobro `PAID`. Los anulados no cuentan (HU-21). |
| `Payment_amount_not_negative` | El monto cobrado no es negativo. |
| `Payment_void_fields` | Un cobro `VOIDED` tiene quién, cuándo y motivo de la anulación; uno `PAID` no tiene ninguno. |
| `Appointment_urgent_has_reason` | Un turno `URGENT` tiene motivo (HU-19). |
| `Appointment_authorization_fields` | Número, fecha y autor de la autorización se cargan todos juntos o ninguno (HU-21). |
| `AppointmentEvent_reschedule_fields` | Un evento `RESCHEDULED` tiene horario y profesional anteriores y nuevos; los demás tipos no los usan (HU-16). |
| `AppointmentEvent_priority_fields` | Un evento `PRIORITY_CHANGED` tiene la prioridad anterior y la nueva, distintas; los demás tipos no las usan (HU-19). |
| `Patient_emergency_contact_pair` | Nombre y teléfono del contacto de emergencia van juntos (HU-17). |

También hay unicidad en el email de ingreso (`User.email`), en la identificación de las personas (`documentType` + `documentNumber` en `Patient` y en `Professional`), en la matrícula (`Professional.licenseNumber`), en `Holiday.date`, en el plan dentro de su obra social, en `Coverage.patientId` y en el nombre del medio de pago (`PaymentMethod.name`).

## Reglas que hace cumplir la DAL

No se pueden expresar en el schema: las hace cumplir la DAL (`src/lib/dal/`) al construirse cada historia. Ni el diagrama ni la base las garantizan.

- `Appointment.endsAt` se calcula con `startsAt` más `Service.durationMinutes`.
- El turno entra completo dentro de una franja del profesional, y no cae en un feriado ni en una excepción de agenda (HU-05, HU-09).
- Un turno solo cambia de estado desde `SCHEDULED`; los otros tres estados son finales.
- El motivo es obligatorio al cancelar (HU-10) y al reprogramar (HU-16).
- Solo se reprograma un turno `SCHEDULED` que todavía no comenzó, y el nuevo horario cumple las mismas reglas que un alta (HU-16).
- Un turno con cobro `PAID` no se cancela ni se reprograma: primero se anula el cobro (HU-21).
- Solo se cobra a pacientes particulares, sobre un turno `SCHEDULED` de hoy o `COMPLETED`, con un servicio que tenga valor y un medio de pago activo. `Payment.amount` se copia de `Service.price` al cobrar (HU-21).
- La autorización solo se registra si el paciente tiene obra social y el servicio requiere orden (HU-21).
- No se desactiva el último medio de pago activo (HU-20).
- No se carga un feriado sobre un día con turnos `SCHEDULED` que todavía no comenzaron (HU-14).
- `Coverage` existe si y solo si `coverageType` es `HEALTH_INSURANCE`.
- Un usuario inactivo no puede ingresar ni sostener una sesión abierta: `getSession()` relee `active` en cada request ([ADR 0002](adr/0002-autenticacion-y-sesion.md)).
- El formato de la matrícula y el resto de la validación de entrada lo hace Zod en cada acción.

## Todavía no modelado

Están en el glosario pero no en el schema, porque pertenecen a incrementos posteriores: `Encounter` (atención registrada), `Prescription` y `Copay` (coseguro), del Inc. 3, y `Overbooking` (sobreturno), que el equipo decidió no construir en el Inc. 2. Cuando entren, se agregan al diagrama en el mismo cambio.

## Mantenimiento

Es un archivo escrito a mano y se desactualiza si nadie lo toca. **Todo cambio en `schema.prisma` o en las restricciones de la migración actualiza este documento en el mismo Pull Request**: entidades y relaciones en el diagrama, y restricciones en las tablas de reglas.

Para ver el diagrama, abrir este archivo en GitHub o en la vista previa de Markdown del editor (con soporte de Mermaid).
