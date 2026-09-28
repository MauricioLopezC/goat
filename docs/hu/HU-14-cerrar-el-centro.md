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

## Comportamiento

- Se carga desde el calendario ([HU-11](HU-11-calendario-del-centro.md)), sobre el día que se está viendo, o desde la pantalla de feriados.
- Si ese día hay turnos Programados que todavía no comenzaron, antes de guardar el sistema muestra cuántos son y la lista (paciente, profesional, hora). Al confirmar:
  - los **cancela en bloque**, cada uno con el motivo "Cierre del centro: <descripción>" y quién lo solicitó "El centro", igual que una cancelación de [HU-10](HU-10-cancelar-turno.md);
  - el cierre y las cancelaciones se guardan juntos: si algo falla, no se guarda nada;
  - si entre la vista previa y la confirmación alguien dio o canceló un turno ese día, el sistema avisa y vuelve a mostrar la lista actualizada.
- El día cerrado aparece **pintado** en todas las vistas del calendario y en la agenda de cada profesional, con la descripción del cierre.
- Quitar un cierre vuelve a habilitar el día, pero no restaura los turnos cancelados.

## Confirmación

- Pide confirmación explícita con la fecha, la descripción y la cantidad de turnos que se van a cancelar.
- Al terminar, muestra la lista de pacientes afectados con su teléfono, para avisarles.
- Quitar un cierre pide confirmación.

## Permisos

- `RECEPTIONIST` y `MANAGER`: cargan y quitan cierres.
- `PROFESSIONAL`: ve el día pintado en su agenda; no carga cierres.

## Operaciones

- `createHoliday` — cambia su contrato: ya no rechaza el día con turnos (`FUTURE_APPOINTMENTS`), sino que exige confirmar la cantidad de turnos que va a cancelar y los cancela en la misma transacción.
- `previewHolidayClosure` — turnos que un cierre cancelaría.
- `listHolidays`, `deleteHoliday` — suman el rol `RECEPTIONIST`.

## A conversar

- Revisión del Inc. 1 (25/09/2026): el cliente pidió que mesa de entradas marque feriados y días excepcionales en una sola acción, pintados en el calendario y sin turnos. Responde la pregunta de [HU-05](HU-05-franjas-de-atencion.md) *¿Quién carga los feriados?*
- **Supuesto del equipo:** un día excepcional es siempre el día completo, no un cierre parcial. A confirmar.
- **Supuesto del equipo:** al cerrar un día con turnos, se cancelan en bloque. Como el aviso por email sigue pendiente ([HU-09](HU-09-asignar-turno.md)), mesa de entradas avisa por teléfono con la lista que muestra el sistema. A confirmar.
- Las excepciones por profesional ([HU-05](HU-05-franjas-de-atencion.md)) no cambian: siguen exigiendo cancelar los turnos antes.
