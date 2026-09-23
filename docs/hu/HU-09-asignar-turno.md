# HU-09 — Asignar un turno

**Incremento:** 1 · **Actividad:** Gestión de turnos

> Como mesa de entrada, necesito asignar a un paciente un turno con un profesional para un servicio en una fecha y hora, para organizar la atención del centro y que el paciente sepa cuándo venir.

## Datos

- **Obligatorios:** paciente, servicio, profesional, fecha, hora de inicio del turno.
- **Calculados por el sistema:** hora de fin, estado, usuario creador, fecha y hora de creación.
- **Opcionales:** observación breve.
- **Fuera del Inc. 1:** prioridad o urgencia, motivo de consulta y sobreturnos, todos al Inc. 2.

## Validaciones

- Solo se listan profesionales activos que presten el servicio elegido.
- Solo se ofrecen horarios dentro de una franja de atención del profesional.
- Un horario ya ocupado no puede asignarse; los bloques ocupados no se muestran como disponibles.
- El bloque reservado debe entrar completo dentro de la franja: un servicio de 30 minutos no puede empezar 15 minutos antes de que termine.
- No se permiten fechas ni horas pasadas.
- No se permite que el mismo paciente tenga dos turnos superpuestos.
- Si dos usuarios toman el mismo horario a la vez, gana el primero; el segundo recibe un aviso de horario ocupado con la grilla refrescada.

## Comportamiento

- Flujo esperado: elegir paciente (o crearlo), elegir servicio, elegir profesional, el sistema muestra los horarios libres, elegir fecha y hora, confirmar.
- Al guardar, el turno queda en estado Programado y el bloque se ocupa en el calendario al instante.
- El turno queda visible en la agenda del profesional y en el calendario general.
- Queda registrado quién lo creó y cuándo.

## Confirmación

- **PENDIENTE:** aviso de turno registrado por email al paciente. Se posterga por indicación de quien dirige el desarrollo (23/09/2026). La confirmación indica expresamente que no se envió correo.
- Pantalla de confirmación con un resumen legible: paciente, servicio, profesional, día, hora y duración.
- Mensaje de éxito y opción de volver al calendario o dar otro turno.

## Permisos

- `RECEPTIONIST` y `MANAGER`: asignan.
- `PROFESSIONAL`: consulta, no asigna.
- Paciente: fuera de alcance del Inc. 1. Aún no está decidido si existirá un canal online y usuario para pacientes.

## Operaciones

- `createAppointment` — alta transaccional; ficha en [`acciones.md`](../acciones.md).
- `getAppointmentOptions` — pacientes por nombre/documento, paciente elegido, servicios activos y profesionales habilitados.
- `listAvailableSlots` — disponibilidad del profesional, servicio, fecha y paciente; lectura desde Server Component.
- `listAppointments` — calendario del centro y agenda propia, con autorización en la DAL.
- `getAppointment` — resumen de confirmación y consulta autorizada.

## Criterios de aceptación verificables

1. Mesa de entradas y gerente pueden asignar; el profesional solo consulta sus propios turnos.
2. Se puede buscar y elegir un paciente activo o registrarlo y continuar desde el alta.
3. El servicio determina la duración; solo se ofrecen profesionales activos que lo presten y tengan franjas habilitadas.
4. Cada bloque entra completo en una franja que habilite el servicio. Se excluyen feriados y ausencias, parciales o completas.
5. Se rechazan fechas y horas pasadas y fechas posteriores a dos meses, según HU-05. Las fechas y horas se interpretan en la zona del centro.
6. No se ofrecen bloques ocupados ni superpuestos con otro turno del paciente. La base respalda ambas restricciones, incluso con solicitudes simultáneas.
7. Si otro usuario ocupa el horario antes de confirmar, se informa el conflicto y se actualizan las opciones sin perder paciente, servicio, profesional y fecha.
8. Al confirmar se crea un único turno Programado, con hora de fin calculada, observación opcional, usuario creador y fecha de creación.
9. El turno se muestra al instante en el calendario general y en la agenda de su profesional.
10. La confirmación muestra paciente, servicio, profesional, fecha, hora y duración, con enlaces al calendario y a otro turno.
11. **PENDIENTE:** enviar el aviso por email al paciente. Postergado expresamente el 23/09/2026; no se considera cumplido por mostrar un mensaje de éxito en pantalla.

La grilla parte del inicio de cada franja y avanza por la duración del servicio. Las vistas de calendario y agenda incluidas aquí permiten consultar el turno creado; el alcance completo de HU-11 y HU-12 se mantiene en sus historias.

El "gana el primero" no se resuelve con una consulta previa más un `insert`: dos usuarios de mesa de entrada pueden reservar a la vez. La restricción va en la base de datos y la DAL traduce el error a `APPOINTMENT_OVERLAP` (ver [ADR 0001](../adr/0001-server-actions-y-capa-de-acceso-a-datos.md), "Concurrencia en turnos").

## A conversar

- **PENDIENTE:** definir proveedor e implementar el aviso por email al paciente, postergado expresamente el 23/09/2026. Informar este pendiente en la revisión con el cliente.
