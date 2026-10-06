# HU-23 — Cerrar el centro por horas o por varios días

**Incremento:** 3 · **Actividad:** Gestión de profesionales

> Como mesa de entrada, necesito cerrar el centro, o marcar la ausencia de un profesional, por varios días seguidos y por un tramo horario en una sola acción, para bloquear unas vacaciones o "de lunes a miércoles de 8 a 12" sin cargar un cierre por día.

## Datos

- **Obligatorios:** descripción o motivo, fecha de inicio y fecha de fin (ambas incluidas). Un solo día es un rango de un día (el cierre de [HU-14](HU-14-cerrar-el-centro.md)).
- **Opcionales:** hora de inicio y hora de fin. Sin horas, el cierre es de los días completos; con horas, el mismo tramo se cierra en cada día del rango (por ejemplo, del lunes al miércoles, de 8:00 a 12:00).
- **Registrados por el sistema:** usuario que lo cargó, fecha y hora.

## Validaciones

- Las fechas son hoy o futuras. La fecha de fin no es anterior a la de inicio. Si hay horas, van las dos y la de fin es posterior a la de inicio.
- Un cierre no se superpone con otro cierre del centro. Una ausencia no se superpone con otra ausencia del mismo profesional.
- Mantiene la regla de [HU-14](HU-14-cerrar-el-centro.md) y [HU-05](HU-05-franjas-de-atencion.md): no se cierra un período que tiene turnos Programados que todavía no comenzaron. El sistema lista los turnos afectados de todo el período, con el teléfono del paciente.
- En un período cerrado no se ofrecen horarios ni se asigna un turno ([HU-09](HU-09-asignar-turno.md)): un turno que toca el tramo cerrado, aunque sea en parte, no se ofrece.

## Comportamiento

- **Cierre del centro:** se carga desde el calendario ([HU-11](HU-11-calendario-del-centro.md)) o desde la pantalla de cierres. Afecta a todos los profesionales.
- **Ausencia de un profesional:** se carga desde sus horarios de atención ([HU-05](HU-05-franjas-de-atencion.md)) con el mismo formulario de rango y tramo opcional. Reemplaza la carga de una ausencia por día; por ejemplo, las vacaciones de una semana.
- En el calendario y en la agenda, un cierre o ausencia con horas se pinta solo en su tramo, en cada día del rango; el resto del día sigue con sus bloques libres.
- La lista de cierres y la de ausencias muestran cada carga una sola vez, con su período y su tramo. Quitarla habilita todo el período.
- Los indicadores ([HU-22](HU-22-indicadores-iniciales.md)) descuentan los tramos cerrados de los minutos disponibles.

## Confirmación

- Pide confirmación con el período, el tramo y la descripción. Quitar un cierre o una ausencia también la pide.

## Permisos

- `RECEPTIONIST` y `MANAGER`: cargan y quitan cierres del centro.
- Ausencias del profesional: los mismos roles que hoy en [HU-05](HU-05-franjas-de-atencion.md).
- `PROFESSIONAL`: ve los cierres y sus ausencias en su agenda.

## Operaciones

- `createHoliday` — suma el rango de fechas y el tramo horario opcional. Mantiene `FUTURE_APPOINTMENTS` con los turnos afectados de todo el período.
- `createAvailabilityException` — suma el rango de fechas, igual que `createHoliday`.
- `listHolidays`, `deleteHoliday`, `deleteAvailabilityException` — trabajan con el período completo.
- `listAvailabilityWindows`, `getCenterIndicators` — descuentan los tramos cerrados.

## A conversar

- Devolución del Inc. 2 (particular): el cliente pidió cerrar por franjas horarias o por varios días, "así lo hacemos de una sola vez". Responde el supuesto de [HU-14](HU-14-cerrar-el-centro.md) de que el día excepcional era siempre completo.
- **Decisión del equipo (05/10/2026):** se puede cargar un tramo horario repetido en varios días (del lunes al miércoles, de 8:00 a 12:00), y las vacaciones del profesional también se cargan por rango.
