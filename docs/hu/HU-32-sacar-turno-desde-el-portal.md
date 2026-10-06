# HU-32 — Sacar un turno desde el portal

**Incremento:** 3 · **Actividad:** Portal del paciente

> Como paciente, necesito sacar un turno por mi cuenta eligiendo el servicio y el primer horario que me queda bien, para no depender del horario de atención telefónica del centro.

## Datos

- Servicio, y profesional, fecha y hora entre los horarios ofrecidos.

## Validaciones

- Valen todas las reglas de [HU-09](HU-09-asignar-turno.md): franjas, cierres, superposición y horizonte de dos meses.
- El paciente solo ve los servicios que no requieren orden médica. Los que la requieren se piden en el mostrador.
- Prioridad siempre normal: la urgencia la marca mesa de entradas ([HU-19](HU-19-turno-prioritario.md)).
- **Supuesto del equipo:** como máximo dos turnos futuros desde el portal, para evitar reservas que no se usan.

## Comportamiento

- El paciente elige el servicio y ve el primer horario libre entre todos los profesionales que lo prestan (`listEarliestSlots`), o elige un profesional y un día.
- El turno queda creado a nombre del paciente; la traza muestra que lo sacó desde el portal.
- Aparece en **Mis turnos** ([HU-31](HU-31-portal-del-paciente.md)) y en el calendario del centro como cualquier otro.

## Confirmación

- Pide confirmación con servicio, profesional, fecha, hora y valor si es particular.

## Permisos

- `PATIENT`: saca turnos solo para sí mismo.

## Operaciones

- `createAppointment` — suma el rol `PATIENT`: el paciente es siempre el de la sesión.
- `listEarliestSlots`, `listAvailableSlots` — suman el rol `PATIENT`.

## A conversar

- Responde la pregunta abierta 5 de [`contexto-goat.md`](../contexto-goat.md).
- ¿El paciente con obra social tiene que cargar la orden al sacar el turno? **Supuesto del equipo:** no; esos servicios no se ofrecen en el portal.
