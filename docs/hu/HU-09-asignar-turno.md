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

- Se envía un aviso de turno registrado por email al paciente.
- Pantalla de confirmación con un resumen legible: paciente, servicio, profesional, día, hora y duración.
- Mensaje de éxito y opción de volver al calendario o dar otro turno.

## Permisos

- `RECEPTIONIST` y `MANAGER`: asignan.
- `PROFESSIONAL`: consulta, no asigna.
- Paciente: fuera de alcance del Inc. 1. Aún no está decidido si existirá un canal online y usuario para pacientes.

## Operaciones

- `createAppointment` — ficha de ejemplo en [`acciones.md`](../acciones.md); se especifica en firme al implementar esta historia.
- Disponibilidad: `listAvailableSlots(professionalId, serviceId, date)` en la DAL, lectura desde Server Component.

El "gana el primero" no se resuelve con una consulta previa más un `insert`: dos usuarios de mesa de entrada pueden reservar a la vez. La restricción va en la base de datos y la DAL traduce el error a `APPOINTMENT_OVERLAP` (ver [ADR 0001](../adr/0001-server-actions-y-capa-de-acceso-a-datos.md), "Concurrencia en turnos").

## A conversar

- **Pendiente:** el aviso por email al paciente no tiene proveedor ni decisión de envío. Si no entra en el Inc. 1, hay que avisarlo explícitamente al cliente.
