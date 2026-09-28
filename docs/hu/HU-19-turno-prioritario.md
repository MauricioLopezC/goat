# HU-19 — Dar un turno prioritario

**Incremento:** 2 · **Actividad:** Gestión de turnos

> Como mesa de entrada, necesito marcar un turno como urgente y encontrar el primer horario libre entre todos los profesionales que prestan el servicio, para atender cuanto antes a un paciente que no puede esperar.

## Datos

- **Nuevos:** prioridad del turno (normal o urgente; por defecto, normal) y, si es urgente, el motivo de la urgencia.

## Validaciones

- Un turno urgente exige motivo.
- El turno urgente respeta todas las reglas de [HU-09](HU-09-asignar-turno.md): no se superpone con otro turno ni queda fuera de una franja. No hay sobreturnos.

## Comportamiento

- En el alta de turno, con el servicio elegido, la opción **Primer horario libre** muestra los próximos horarios disponibles del centro para ese servicio, entre todos los profesionales que lo prestan, ordenados por fecha y hora. Al elegir uno quedan cargados profesional, fecha y hora.
- La opción sirve también para turnos normales.
- Los turnos urgentes se destacan en el calendario ([HU-11](HU-11-calendario-del-centro.md)), en la agenda del profesional ([HU-12](HU-12-agenda-del-profesional.md)) y en el historial del paciente ([HU-18](HU-18-historial-de-turnos-del-paciente.md)).
- La prioridad se puede cambiar desde el detalle del turno mientras está Programado; el cambio queda en su historial.

## Permisos

- `RECEPTIONIST` y `MANAGER`: marcan la prioridad y usan la búsqueda.
- `PROFESSIONAL`: ve la prioridad de sus turnos.

## Operaciones

- `createAppointment` — suma la prioridad y su motivo.
- `listEarliestSlots` — primeros horarios libres de un servicio entre todos los profesionales que lo prestan.
- `updateAppointmentPriority` — cambio de prioridad con traza.

## A conversar

- El contexto (D-06) confirma que el turno considera prioridad o urgencia, pero no dice cómo.
- **Decisión del equipo:** sin sobreturnos. Un sobreturno exige romper la regla de no superposición, que no se negocia. La urgencia se resuelve con la marca y con la búsqueda del primer horario libre. Queda como pregunta para la revisión: ¿el centro necesita sobreturnos?
- Si falta tiempo, se entrega solo la marca de prioridad y la búsqueda pasa al Inc. 3.
