# HU-11 — Ver el calendario de turnos del centro

**Incremento:** 1 · **Actividad:** Calendario

> Como mesa de entrada, necesito ver la agenda del día con todos los profesionales, para saber quién está atendiendo, qué horarios quedan libres y responder al instante cuando alguien pide un turno.

## Datos

- Por turno se muestra: hora de inicio, apellido y nombre del paciente, profesional, servicio y estado.
- **Bloque libre:** tramo de una franja de atención del profesional que no cae en un feriado ni en una ausencia y no está ocupado por un turno Programado o Completado. Los turnos Cancelados y Vencidos no ocupan.

## Validaciones

- Si no hay ningún profesional con franja ese día, se muestra un mensaje explícito, no una grilla vacía sin explicación. Si el día es feriado, el mensaje lo nombra.
- Solo se ofrecen como bloques libres los horarios que el alta de turno aceptaría: desde ahora hasta dos meses inclusive ([HU-09](HU-09-asignar-turno.md)). El tiempo libre ya pasado se muestra vacío, sin enlace.
- Completar un turno exige que ya haya comenzado; marcarlo Vencido exige que ya haya terminado. Así un turno futuro nunca libera su horario por error.
- Solo se cambia el estado de un turno Programado; los otros tres estados son finales.

## Comportamiento

- Vistas de día y semana. Por defecto abre en el día de hoy. La vista mensual queda postergada (ver *A conversar*).
- **Vista día:** una columna por profesional con franja ese día, sobre un eje horario. Las horas fuera de la franja se muestran como no disponibles.
- **Vista semana:** una fila por profesional y una columna por día. Cada celda lista los turnos del día y cuántos bloques libres quedan; al hacer clic se abre ese día. Si se filtra por un profesional, la semana se muestra como grilla horaria, igual que su agenda ([HU-12](HU-12-agenda-del-profesional.md)).
- Filtros por profesional y por servicio, y opción para ocultar los turnos cancelados ([HU-10](HU-10-cancelar-turno.md)).
  - Con filtro de servicio, solo aparecen los profesionales que lo prestan y las franjas que lo habilitan, y los bloques libres se dividen según la duración del servicio, desde el inicio de cada franja, igual que en el alta.
- Se distinguen visualmente bloque ocupado, bloque libre y turno cancelado.
- Navegación al día o semana anterior y siguiente, y acceso rápido a hoy.
- La vista, la fecha y los filtros quedan en la dirección de la página: al volver del detalle de un turno se recupera el mismo calendario.
- Al hacer clic en un bloque libre se abre el alta de turno con profesional, fecha y hora precargados. Se conservan mientras se elige paciente y servicio. Si la hora no es un horario ofrecido para el servicio elegido, el alta lo avisa y deja elegir otro.
- Al hacer clic en un turno se abre su detalle, con la opción de cambiar su estado a Cancelado ([HU-10](HU-10-cancelar-turno.md)), Completado o Vencido.
  - Completar y marcar Vencido piden confirmación y admiten un motivo opcional.
  - Cada cambio registra quién lo hizo y cuándo, y queda en el historial del turno.

## Permisos

- `RECEPTIONIST` y `MANAGER`: ven la agenda de todos los profesionales y cambian el estado de los turnos.
- `PROFESSIONAL`: ver [HU-12](HU-12-agenda-del-profesional.md). No completa ni vence turnos en este incremento.

## Operaciones

Lecturas desde el Server Component de `/calendar`, y cambios de estado desde el detalle del turno. Fichas en [`acciones.md`](../acciones.md).

- `listAppointments` — turnos de un rango de días, con filtros de profesional, servicio y cancelados.
- `listAvailabilityWindows` — profesionales con sus franjas, ausencias y los feriados del rango, para calcular los bloques libres.
- `cancelAppointment` — de [HU-10](HU-10-cancelar-turno.md), sin cambios.
- `completeAppointment` y `expireAppointment` — errores esperados: `INVALID_STATUS_TRANSITION` si el turno no está Programado o todavía no comenzó (completar) o no terminó (vencer).

## A conversar

- **Vista mensual diferida:** Igual que en [HU-12](HU-12-agenda-del-profesional.md), para el Incremento 1 se priorizan las vistas operativas de día y semana. La vista mensual queda postergada y se informa como recorte en la revisión con el cliente.
- **El profesional completa sus turnos:** en el Incremento 1 solo mesa de entradas y gerente cambian el estado. Queda por confirmar con el cliente si el profesional debería marcar la atención desde su agenda.
- **Vencimiento automático:** en el Incremento 1 el turno se marca Vencido a mano; no hay proceso automático (ver `glossary.md`).
