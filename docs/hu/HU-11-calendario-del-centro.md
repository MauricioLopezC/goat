# HU-11 — Ver el calendario de turnos del centro

**Incremento:** 1 · **Actividad:** Calendario

> Como mesa de entrada, necesito ver la agenda del día con todos los profesionales, para saber quién está atendiendo, qué horarios quedan libres y responder al instante cuando alguien pide un turno.

## Datos

- Por turno se muestra: hora de inicio, apellido y nombre del paciente, profesional, servicio y estado.

## Validaciones

- Si no hay ningún profesional con franja ese día, se muestra un mensaje explícito, no una grilla vacía sin explicación.

## Comportamiento

- Vistas de día, semana y mes. Por defecto abre en el día de hoy.
- Filtros por profesional y por servicio.
- Se distinguen visualmente bloque ocupado, bloque libre y turno cancelado.
- Navegación al día, semana o mes anterior y siguiente, y acceso rápido a hoy.
- Al hacer clic en un bloque libre se abre el alta de turno con profesional, fecha y hora precargados.
- Al hacer clic en un turno se abre su detalle, con la opción de cambiar su estado a Cancelado, Completado o Vencido.

## Permisos

- `RECEPTIONIST` y `MANAGER`: ven la agenda de todos los profesionales.
- `PROFESSIONAL`: ver [HU-12](HU-12-agenda-del-profesional.md).

## Operaciones

Historia de solo lectura, salvo las acciones que se disparan desde el detalle, que son las de [HU-09](HU-09-asignar-turno.md) y [HU-10](HU-10-cancelar-turno.md).

- `listAppointments(range, filters)` y `listAvailabilityWindows(date)` en la DAL, desde Server Components.
