# HU-18 — Ver el historial de turnos del paciente

**Incremento:** 2 · **Actividad:** Atención e historial

> Como profesional, necesito ver la cronología de los turnos que un paciente tuvo conmigo, para saber cuándo vino, para qué servicio y si faltó, antes de atenderlo.

## Datos

- Por turno: fecha y hora, servicio, profesional, estado, prioridad, observaciones y, si tiene, el cobro ([HU-21](HU-21-cobrar-turno.md)). El profesional no ve el cobro.
- Por cambio: reprogramaciones, cancelación con su motivo, cierre como Completado o Vencido, con quién y cuándo.

## Validaciones

- Sin turnos, se muestra un mensaje explícito.

## Comportamiento

- Se ve en la ficha del paciente ([HU-17](HU-17-ficha-completa-del-paciente.md)), del más reciente al más antiguo, con los próximos turnos separados de los pasados.
- Se llega desde el detalle de un turno, desde la agenda del profesional y desde la búsqueda de pacientes.
- Filtro por estado; mesa de entradas y el gerente filtran además por profesional. Se recorre de a 10.
- Muestra la asistencia del paciente: cantidad de turnos Completados y Vencidos.

## Permisos

- `RECEPTIONIST` y `MANAGER`: consultan todos los turnos del paciente.
- `PROFESSIONAL`: consulta solo los turnos del paciente con él. La DAL aplica el filtro, no la pantalla.

## Operaciones

- `getPatientAppointmentHistory` — turnos del paciente con sus eventos, paginados.

## A conversar

- **Decisión del equipo:** en el Inc. 2 el historial es la cronología de turnos. La atención registrada (`Encounter`) y las prescripciones entran en el Inc. 3 y completan este historial con el contenido clínico.
- ¿El profesional ve los turnos del paciente con otros profesionales?
  - **Decisión del equipo (28/09/2026):** no, para simplificar. Ve solo los turnos del paciente con él. Se puede ampliar en el Inc. 3, junto con la atención registrada.
