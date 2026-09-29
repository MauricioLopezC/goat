# HU-16 — Reprogramar un turno

**Incremento:** 2 · **Actividad:** Gestión de turnos

> Como mesa de entrada, necesito mover un turno a otro día u horario, o a otro profesional que preste el mismo servicio, dejando registrado el motivo, para resolver el pedido del paciente sin cancelar y volver a dar el turno.

## Datos

- **Obligatorios:** nueva fecha y hora; motivo y quién lo solicitó (el paciente, el profesional, el centro).
- **Opcionales:** otro profesional que preste el mismo servicio.
- **Registrados por el sistema:** usuario, fecha y hora del cambio, y el horario y profesional anteriores.

## Validaciones

- Solo se reprograma un turno Programado que todavía no comenzó.
- El nuevo horario cumple las mismas reglas que un turno nuevo ([HU-09](HU-09-asignar-turno.md)): dentro de una franja que habilite el servicio, sin feriado ni ausencia, sin superposición para el profesional ni para el paciente, no pasado y dentro de los dos meses.
- El horario que ocupa el mismo turno no cuenta como ocupado: se puede mover dentro del mismo día.
- Sin motivo no se reprograma.
- Si dos usuarios toman el mismo horario a la vez, gana el primero (igual que [HU-09](HU-09-asignar-turno.md)).

## Comportamiento

- Se inicia desde el detalle del turno. El selector de fechas y horarios es el mismo del alta, con paciente y servicio fijos.
- El turno conserva su identidad, su autor y su historial: no se cancela ni se crea otro.
- El horario anterior queda libre de inmediato y el nuevo, ocupado.
- En el historial del turno queda una entrada "Reprogramado" con el horario y profesional anterior y nuevo, el motivo, quién lo pidió, quién lo hizo y cuándo.

## Confirmación

- Pide confirmación mostrando el horario anterior y el nuevo.
- Mensaje de éxito con el nuevo día, hora y profesional.

## Permisos

- `RECEPTIONIST` y `MANAGER`: reprograman.
- `PROFESSIONAL`: no reprograma.

## Operaciones

- `rescheduleAppointment` — errores esperados: `INVALID_STATUS_TRANSITION` si el turno no está Programado o ya comenzó, `REASON_REQUIRED`, y los mismos de `createAppointment` si el nuevo horario no está disponible (`APPOINTMENT_OVERLAP`, `PATIENT_APPOINTMENT_OVERLAP`, `OUTSIDE_AVAILABILITY_WINDOW`).
- `listAvailableDates`, `listAvailableSlots` — aceptan el turno que se reprograma, para no contarlo como ocupado.

## Criterios de aceptación verificables

1. Mesa de entradas y gerente pueden reprogramar; el profesional solo consulta sus propios turnos y no tiene acceso a reprogramar.
2. Solo se puede reprogramar un turno en estado Programado (`SCHEDULED`) que todavía no haya comenzado (`startsAt > now`). Un turno cancelado, completado, vencido o ya comenzado se rechaza con `INVALID_STATUS_TRANSITION`.
3. El paciente y el servicio quedan fijos. Se permite conservar el mismo profesional o elegir otro profesional activo que preste el servicio y tenga franjas habilitadas.
4. El selector de fechas y horarios ofrece bloques disponibles calculados según las reglas de [HU-09](HU-09-asignar-turno.md) (franja habilitada, sin feriados ni ausencias, dentro de los dos meses y no pasado).
5. El turno que se reprograma no cuenta como ocupado en la consulta de fechas ni horarios (`excludeAppointmentId`), permitiendo moverlo dentro del mismo día sin que se auto-bloquee.
6. Sin motivo (`reason`) no se reprograma (`REASON_REQUIRED`). Se registra obligatoriamente quién solicitó el cambio (`requestedBy`: paciente, profesional o centro).
7. La operación se ejecuta en una transacción `Serializable`: el turno conserva su ID, autor original y fecha de creación, actualizando `startsAt`, `endsAt` y `professionalId`.
8. La transacción genera un evento inmutable en el historial (`AppointmentEvent`) con tipo `RESCHEDULED`, horario y profesional anteriores y nuevos, motivo, solicitante, usuario actor y fecha del cambio.
9. Si otro usuario toma el mismo horario a la vez, gana el primero: las restricciones de exclusión de PostgreSQL respaldan ambos solapamientos (`APPOINTMENT_OVERLAP` o `PATIENT_APPOINTMENT_OVERLAP`) y se informa el error refrescando la grilla.
10. La interfaz pide confirmación mostrando el horario/profesional anterior y el nuevo, y tras confirmar muestra un mensaje de éxito con el nuevo día, hora y profesional.

## A conversar

- **Supuesto del equipo:** cambiar el servicio no es reprogramar: se cancela y se da un turno nuevo, porque cambia la duración y el valor. A confirmar.
- ¿Hay que limitar las reprogramaciones de un turno?
  - **Decisión del equipo (28/09/2026):** no hay límite.
