# HU-18 — Ver el historial de turnos del paciente

**Incremento:** 2 · **Actividad:** Atención e historial

> Como profesional, necesito ver la cronología de turnos de un paciente, para saber cuándo vino, con quién, para qué servicio y si faltó, antes de atenderlo.

## Datos

- Por turno: fecha y hora, servicio, profesional, estado, prioridad, observaciones y, si tiene, el cobro ([HU-21](HU-21-cobrar-turno.md)).
- Por cambio: reprogramaciones, cancelación con su motivo, cierre como Completado o Vencido, con quién y cuándo.

## Validaciones

- Sin turnos, se muestra un mensaje explícito.

## Comportamiento

- Se ve en la ficha del paciente ([HU-17](HU-17-ficha-completa-del-paciente.md)), del más reciente al más antiguo, con los próximos turnos separados de los pasados.
- Se llega desde el detalle de un turno, desde la agenda del profesional y desde la búsqueda de pacientes.
- Filtros por estado y por profesional. Se recorre de a 10.
- Muestra la asistencia del paciente: cantidad de turnos Completados y Vencidos.

## Permisos

- `RECEPTIONIST`, `MANAGER` y `PROFESSIONAL`: consultan.

## Operaciones

- `getPatientAppointmentHistory` — turnos del paciente con sus eventos, paginados.

## A conversar

- **Decisión del equipo:** en el Inc. 2 el historial es la cronología de turnos. La atención registrada (`Encounter`) y las prescripciones entran en el Inc. 3 y completan este historial con el contenido clínico.
- **Supuesto del equipo:** el profesional ve el historial completo del paciente, incluidos los turnos con otros profesionales, porque le sirve para atenderlo. A confirmar.
