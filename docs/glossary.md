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
| Bloque libre | `FreeBlock` | Tramo de una franja sin feriado, ausencia ni turno Programado o Completado, de al menos 30 minutos (duración mínima de un servicio). Se muestra en el calendario del centro; con un servicio elegido se divide como un `AvailableSlot`. No es una entidad persistida. |
| Agenda propia de turnos | `/agenda` | El profesional consulta exclusivamente sus turnos. Distinta de `/my-schedule`, que muestra sus franjas. |
| Prestación | `Service` | Lo que se hace en el turno; determina duración y valor. |
| Área / línea de atención | `Specialty` | Columna, Rodilla, Hombro, etc. No confundir con la prestación. |
| Franja de atención | `AvailabilityWindow` | Horario en que un profesional atiende un día determinado. |
| Sobreturno | `Overbooking` | Pendiente de la pregunta abierta 2 al cliente. En el Inc. 2 no se construye: la urgencia se resuelve con la prioridad del turno ([HU-19](hu/HU-19-turno-prioritario.md)). |
| Obra social | `HealthInsurer` | |
| Plan | `InsurancePlan` | |
| Afiliación del paciente | `Coverage` | Plan más número de afiliado. |
| Coseguro | `Copay` | Lo que paga el paciente aunque tenga cobertura. No se construye: el centro solo cobra a pacientes particulares (decisión del equipo, Inc. 3). El campo `Coverage.copayAmount` del Inc. 1 se eliminó en el Inc. 2. |
| Atención registrada | `Encounter` | Notas e indicaciones en texto libre que el profesional deja de un turno, una por turno. Base de la bitácora del paciente. No es una historia clínica ([HU-25](hu/HU-25-registrar-la-atencion.md)). |
| Prescripción | `Encounter.indications` | Texto libre dentro de la atención registrada. No hay modelo `Prescription` ni tipificación, por la devolución del cliente del Inc. 2 ([HU-25](hu/HU-25-registrar-la-atencion.md)). |
| Pago / cobro | `Payment` | Cobro de un turno de un paciente particular en el mostrador, con un solo medio de pago. Guarda lo que paga el paciente (`amount`) con el monto del momento, separado del valor de la prestación ([HU-21](hu/HU-21-cobrar-turno.md)). |
| Turnos de hoy | `today` | Pantalla de mesa de entradas con todos los turnos de hoy por horario, su estado de cobro o autorización y la acción de cobrar o autorizar en la fila (`/today`, [HU-21](hu/HU-21-cobrar-turno.md)). No es un modelo: lee `Appointment` y `Payment`. |
| Medio de pago | `PaymentMethod` | Efectivo, débito, crédito, transferencia. Lo configura el gerente ([HU-20](hu/HU-20-aranceles-y-medios-de-pago.md)). |
| Usuario | `User` | Cuenta con la que se ingresa al sistema. Lleva el `Role`. |
| Título profesional | `ProfessionalTitle` | Traumatólogo, kinesiólogo. Un `Professional` puede tener más de uno. No confundir con `Specialty` (área) ni con `Service` (prestación). |
| Horarios de atención | `schedule` | Franjas y excepciones de agenda de un profesional, juntas ([HU-05](hu/HU-05-franjas-de-atencion.md)). Es el nombre de la pantalla (`/professionals/[id]/schedule`, y `/my-schedule` para el propio profesional). No confundir con la agenda del profesional ([HU-12](hu/HU-12-agenda-del-profesional.md)), que son sus turnos. |
| Excepción de agenda / ausencia | `AvailabilityException` | Día u horario en que el profesional no atiende, contra su patrón de `AvailabilityWindow`. Desde el Inc. 3 se carga por rango de días, con un tramo horario opcional, como el cierre del centro ([HU-23](hu/HU-23-cerrar-el-centro-por-horas-o-dias.md)). |
| Consultorio / box | `Room` | En el Incremento 1 cada profesional tiene el suyo. |
| Feriado / día excepcional / cierre del centro | `Holiday` | Período en que el centro permanece cerrado: un día completo ([HU-14](hu/HU-14-cerrar-el-centro.md)) y, desde el Inc. 3, un rango de días, con un tramo horario opcional que se repite en cada día ([HU-23](hu/HU-23-cerrar-el-centro-por-horas-o-dias.md)). No genera disponibilidad para nadie. Lo cargan gerente y mesa de entradas, y no se carga sobre un día con turnos Programados ([HU-14](hu/HU-14-cerrar-el-centro.md)). No existe un modelo aparte para el día excepcional. |
| Traza de cambios de un turno | `AppointmentEvent` | Qué cambió en un turno ya creado, quién, cuándo y por qué. El alta no genera evento: su autoría vive en `Appointment.createdById`. |
| Traza de cambios de un profesional | `ProfessionalEvent` | Edición, baja o reactivación con autor, fecha y motivo. |
| Reprogramar | `rescheduleAppointment` | Mover un turno Programado a otro horario o profesional, conservando el mismo `Appointment`. Deja un `AppointmentEvent` de tipo `RESCHEDULED` con el horario anterior y el nuevo ([HU-16](hu/HU-16-reprogramar-turno.md)). |
| Valor de la prestación | `Service.price` | Lo que vale un servicio, antes de la cobertura. |
| Número de autorización | `authorizationNumber` | Orden o autorización de la obra social para un turno. Se registra al llegar el paciente, cuando el servicio requiere orden y hay obra social, con quién (`authorizedById`) y cuándo (`authorizedAt`) ([HU-21](hu/HU-21-cobrar-turno.md)). |
| Primer horario libre | `listEarliestSlots` | Los próximos `AvailableSlot` de un servicio entre todos los profesionales que lo prestan ([HU-19](hu/HU-19-turno-prioritario.md)). |
| Historial del paciente | `getPatientAppointmentHistory` | En el Inc. 2, la cronología de turnos del paciente con sus cambios ([HU-18](hu/HU-18-historial-de-turnos-del-paciente.md)). En el Inc. 3 suma la atención registrada y pasa a ser la bitácora del paciente ([HU-26](hu/HU-26-bitacora-del-paciente.md)). |
| Tablero del gerente | `/dashboard` | Indicadores del centro: ocupación, ausentismo y cancelaciones ([HU-22](hu/HU-22-indicadores-iniciales.md)). |
| Ocupación | `occupancyRate` | Minutos ocupados por turnos Programados y Completados sobre los minutos de franja disponibles, en un período. |
| Ausentismo | `absenteeismRate` | Turnos Vencidos sobre Completados más Vencidos, en un período. |
| Turno sin cerrar | `UnclosedAppointment` | Turno Programado cuya hora de fin ya pasó. Se lista en `/appointments/unclosed` para marcarlo Completado o Vencido. No es una entidad persistida. |
| Domicilio | `address`, `city` | Del `Patient` ([HU-17](hu/HU-17-ficha-completa-del-paciente.md)). |
| Observaciones administrativas | `Patient.notes` | Notas del mostrador sobre el paciente ([HU-17](hu/HU-17-ficha-completa-del-paciente.md)). No son datos clínicos. |
| Contacto de emergencia | `emergencyContactName`, `emergencyContactPhone`, `emergencyContactRelationship` | Del `Patient`. Distinto del responsable o tutor (`guardianName`). |
| Comprobante | `receiptNumber` | Constancia no fiscal de un cobro, con la marca del centro y número correlativo (`Payment.receiptNumber`). No es una factura ([HU-24](hu/HU-24-comprobante-de-cobro.md)). Inc. 3. |
| Datos del centro | `centerProfile` | Nombre, razón social, CUIT, dirección y teléfono del centro, configurados en un solo lugar. Los usa el comprobante ([HU-24](hu/HU-24-comprobante-de-cobro.md)). Inc. 3. |
| Cierre de caja | `CashClosing` | Cierre de los cobros de un día del centro, con el detalle por medio y por profesional, el efectivo contado y la diferencia ([HU-27](hu/HU-27-cierre-de-caja.md)). Inc. 3. |
| Rendición por profesional | `getProfessionalStatement` | Producido (pacientes atendidos), cobrado (lo pagado por particulares), comisión del centro y neto de un profesional en un período ([HU-28](hu/HU-28-rendicion-por-profesional.md)). Inc. 3. |
| Comisión del centro | `centerCommissionRate` | 15 % de lo cobrado por los turnos de un profesional, por el uso de las instalaciones. Cálculo informativo, no liquidación de honorarios ([HU-28](hu/HU-28-rendicion-por-profesional.md)). Inc. 3. |
| Portal del paciente | `/portal` | Pantallas del rol `PATIENT`: sus turnos, cancelación y comprobantes ([HU-31](hu/HU-31-portal-del-paciente.md)). El acceso es un `User` vinculado al `Patient` (`Patient.userId`). Inc. 3. |

## Campos compartidos del incremento 3

| Español | En código | Nota |
|---|---|---|
| Período del cierre o ausencia | `startDate`, `endDate` | Fechas inclusivas de `Holiday` y `AvailabilityException`. |
| Tramo diario del cierre o ausencia | `startMinute`, `endMinute` | Minutos desde medianoche; ambos nulos = días completos. El tramo se repite en cada fecha. |
| Autor de la atención | `Encounter.professionalId` | Profesional que registra las notas. |
| Cambio de contraseña pendiente | `User.mustChangePassword` | Acceso con contraseña temporal; HU-31 exige cambiarla al ingresar. |
| Caja del cobro | `Payment.cashClosingId` | Nulo hasta cerrar el día de cobro. |
| Cantidad y total originales al cierre | `CashClosing.paymentCount`, `totalAmount` | Foto de los cobros vigentes al cerrar; no cambia ante anulaciones posteriores. |
| Efectivo esperado y contado | `CashClosing.expectedCashAmount`, `countedCashAmount` | Original del sistema frente al conteo físico. |
| Diferencia de caja | `CashClosing.difference` | Contado menos esperado. Si no es cero exige `notes`. |
| Autor e instante del cierre | `CashClosing.closedById`, `closedAt` | Quién cerró y cuándo. `CashClosing.date` es el día local de los cobros. |
| Ajuste posterior al cierre | `Payment.voidedAt`, `voidedById`, `voidReason` | Misma auditoría de anulación; posterior a `CashClosing.closedAt`. No es otra entidad. |

## Enums

**Estado del turno** (`AppointmentStatus`): `SCHEDULED` (Programado) → `COMPLETED` (Completado: el paciente vino), o `CANCELLED` (Cancelado), o `EXPIRED` (Vencido). Se usa `CANCELLED` (grafía británica) en todo el código.

- `SCHEDULED` es el único estado desde el que se puede transicionar: los otros tres son finales.
- `EXPIRED` es el turno cuya hora pasó sin que se registrara la atención. Lo marca el usuario desde el detalle del turno o desde la lista de turnos sin cerrar; no hay proceso automático (decisión del equipo, Inc. 3).
- No existen `CONFIRMED` ni `NO_SHOW`: el equipo los reemplazó por este juego de cuatro estados.

**Rol** (`Role`): `RECEPTIONIST` (mesa de entradas), `PROFESSIONAL`, `MANAGER` (gerente), `PATIENT` (opcional).

**Tipo de documento** (`DocumentType`): `DNI`, `LC`, `LE`, `CI`, `PASSPORT`. Junto con el número forma la identificación única de un `Patient` y de un `Professional`.

**Género** (`Gender`): `MALE`, `FEMALE`, `OTHER`.

**Tipo de cobertura** (`CoverageType`): `PRIVATE` (particular) o `HEALTH_INSURANCE` (obra social). Cuando es `HEALTH_INSURANCE`, el paciente tiene además una `Coverage`.

**Día de la semana** (`Weekday`): `MONDAY` a `SUNDAY`. Es el día del patrón semanal de una `AvailabilityWindow`, no una fecha.

**Tipo de cambio en un turno** (`AppointmentEventType`): `UPDATED` (incluye la corrección del número de autorización, [HU-21](hu/HU-21-cobrar-turno.md)), `CANCELLED`, `COMPLETED`, `EXPIRED`, y desde el Inc. 2 `RESCHEDULED` (reprogramado) y `PRIORITY_CHANGED` (cambio de prioridad, con `previousPriority` y `newPriority`; [HU-19](hu/HU-19-turno-prioritario.md)).

**Prioridad del turno** (`AppointmentPriority`): `NORMAL` o `URGENT` (urgente). Un turno `URGENT` lleva su motivo en `priorityReason` ([HU-19](hu/HU-19-turno-prioritario.md)).

**Estado del cobro** (`PaymentStatus`): `PAID` (cobrado) o `VOIDED` (anulado). Un turno tiene como máximo un `Payment` en `PAID`. Un turno sin cobro vigente está *pendiente de cobro*; no hay un estado persistido para eso. Del mismo modo, un turno de un paciente con obra social cuyo servicio requiere orden está *pendiente de autorización* hasta que tiene `authorizationNumber`, y entonces está *autorizado*. Estos cuatro estados se calculan con `paymentState` (`src/lib/payments.ts`): `PENDING_PAYMENT`, `PAID`, `PENDING_AUTHORIZATION` y `AUTHORIZED` ([HU-21](hu/HU-21-cobrar-turno.md)).

**Tipo de cambio en un profesional** (`ProfessionalEventType`): `UPDATED`, `DEACTIVATED`, `REACTIVATED`.

**Alta y baja** (activo/inactivo): campo `active` de tipo booleano, con el mismo nombre en `User`, `Patient`, `Professional` y `Service`. La baja siempre es lógica: no se borra el registro.

## Sin nombre todavía

Definir antes de modelarlos: tipo de turno (primera consulta, control, post-quirúrgico, práctica, kinesiología), series o packs de kinesiología. La prioridad o urgencia ya tiene nombre: `AppointmentPriority`.
