# HU-14 — Cerrar el centro por un feriado o un día excepcional

**Incremento:** 2 · **Actividad:** Gestión de profesionales

> Como mesa de entrada, necesito marcar un feriado o día excepcional en una sola acción, para que el calendario de todos los profesionales quede bloqueado ese día sin cargar una excepción por cada uno.

## Datos

- **Obligatorios:** fecha y descripción (por ejemplo, "Feriado nacional" o "Desinfección del centro").
- **Registrados por el sistema:** usuario que lo cargó, fecha y hora.

## Validaciones

- La fecha es hoy o futura, dentro del horizonte de turnos (dos meses) o más adelante.
- No puede haber dos cierres el mismo día.
- El cierre es siempre del día completo.
- En un día cerrado no se ofrecen horarios ni se puede asignar un turno (ya lo cumple [HU-09](HU-09-asignar-turno.md)).
- No se puede cerrar un día que tiene turnos Programados que todavía no comenzaron: el sistema avisa y lista los turnos afectados, que hay que cancelar o reprogramar antes. Es la misma regla que al eliminar o acortar una franja de un profesional ([HU-05](HU-05-franjas-de-atencion.md)).

## Comportamiento

- Se carga desde el calendario ([HU-11](HU-11-calendario-del-centro.md)), sobre el día que se está viendo, o desde la pantalla de feriados.
- Si el día tiene turnos, la lista de turnos afectados muestra paciente, teléfono, profesional y hora, con acceso al detalle de cada uno para cancelarlo ([HU-10](HU-10-cancelar-turno.md)) o reprogramarlo ([HU-16](HU-16-reprogramar-turno.md)). Con el día libre de turnos, se vuelve a intentar el cierre.
- El día cerrado aparece **pintado** en todas las vistas del calendario y en la agenda de cada profesional, con la descripción del cierre.
- Quitar un cierre vuelve a habilitar el día.

## Confirmación

- Pide confirmación explícita con la fecha y la descripción.
- Mensaje de éxito indicando que el centro quedó cerrado ese día.
- Quitar un cierre pide confirmación.

## Permisos

- `RECEPTIONIST` y `MANAGER`: cargan y quitan cierres.
- `PROFESSIONAL`: ve el día pintado en su agenda; no carga cierres.

## Operaciones

- `createHoliday` — mantiene su contrato: rechaza el día con turnos con `FUTURE_APPOINTMENTS` y los turnos afectados en `meta.appointments`. Suma el rol `RECEPTIONIST` y el teléfono del paciente en los turnos afectados.
- `listHolidays`, `deleteHoliday` — suman el rol `RECEPTIONIST`.

## A conversar

- Revisión del Inc. 1 (25/09/2026): el cliente pidió que mesa de entradas marque feriados y días excepcionales en una sola acción, pintados en el calendario y sin turnos. Responde la pregunta de [HU-05](HU-05-franjas-de-atencion.md) *¿Quién carga los feriados?*
- **Supuesto del equipo:** un día excepcional es siempre el día completo, no un cierre parcial. A confirmar.
  - **Respuesta del cliente (devolución del Inc. 2):** no; también se cierra por franjas horarias o por varios días. Se planifica en [HU-23](HU-23-cerrar-el-centro-por-horas-o-dias.md).
- ¿Qué pasa al cerrar un día que ya tiene turnos?
  - **Decisión del equipo (28/09/2026):** no se permite. Se maneja con la misma lógica que eliminar o acortar una franja de un profesional ([HU-05](HU-05-franjas-de-atencion.md)): el sistema lista los turnos afectados y hay que cancelarlos o reprogramarlos antes. Como el aviso por email sigue pendiente ([HU-09](HU-09-asignar-turno.md)), la lista incluye el teléfono del paciente para avisarle.
