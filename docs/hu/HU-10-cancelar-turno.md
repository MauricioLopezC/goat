# HU-10 — Cancelar un turno

**Incremento:** 1 · **Actividad:** Gestión de turnos

> Como mesa de entrada, necesito cancelar un turno dejando registrado el motivo, para liberar el horario y poder ofrecérselo a otro paciente.

## Datos

- **Obligatorios:** observación en texto libre con el motivo de la cancelación y quién la solicitó.
- **Registrados por el sistema:** usuario que cancela, fecha y hora.

## Validaciones

- Solo se pueden cancelar turnos en estado Programado.
- Un turno ya cancelado no puede volver a cancelarse.
- El motivo es obligatorio: sin motivo no se cancela.

## Comportamiento

- El turno pasa a estado Cancelado.
- El horario queda libre y vuelve a ofrecerse de inmediato.
- El turno cancelado no se borra: sigue visible en el calendario con un estilo diferenciado y puede ocultarse con un filtro.
- La cancelación no es reversible: si el paciente se arrepiente, se da un turno nuevo.

## Confirmación

- Pide confirmación explícita mostrando paciente, profesional, servicio, día y hora.
- Mensaje de éxito indicando que el horario quedó liberado.

## Permisos

- `RECEPTIONIST` y `MANAGER`: cancelan.
- `PROFESSIONAL`: no cancela turnos.

## Operaciones

- `cancelAppointment` — errores esperados: `INVALID_STATUS_TRANSITION` si el turno no está programado, `REASON_REQUIRED` si falta el motivo.
