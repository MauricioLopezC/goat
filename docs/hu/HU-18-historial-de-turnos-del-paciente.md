# HU-18 — Ver el historial de turnos del paciente

**Incremento:** 2 · **Actividad:** Atención e historial

> Como profesional, necesito ver la cronología de los turnos que un paciente tuvo conmigo, para saber cuándo vino, para qué servicio y si faltó, antes de atenderlo.

## Datos

- Por turno: fecha y hora, servicio, profesional, estado, prioridad, observaciones y, si tiene, el cobro ([HU-21](HU-21-cobrar-turno.md)). El profesional no ve el cobro.
- Por cambio: reprogramaciones, cancelación con su motivo, cierre como Completado o Vencido, con quién y cuándo.

## Validaciones

- Sin turnos, se muestra un mensaje explícito.

## Comportamiento

- Se ve en la ficha del paciente ([HU-17](HU-17-ficha-completa-del-paciente.md)), del más reciente al más antiguo, con los próximos turnos separados de los pasados. Próximo es un turno Programado que todavía no empezó; el resto, incluido un Programado cuya hora ya pasó, va con los pasados.
- Se llega desde el detalle de un turno, desde la agenda del profesional y desde la búsqueda de pacientes.
- Filtro por estado; mesa de entradas y el gerente filtran además por profesional, entre los que atendieron o tienen turno con el paciente. Se recorre de a 10: una sola lista paginada, y en cada página los próximos van bajo su encabezado y los pasados bajo el suyo.
- Muestra la asistencia del paciente: cantidad de turnos Completados y Vencidos. Cuenta todos los turnos que el usuario puede ver, del profesional filtrado si lo hay; no cambia con el filtro de estado ni con la página.
- Del cobro se muestra solo el vigente; los anulados no.

## Permisos

- `RECEPTIONIST` y `MANAGER`: consultan todos los turnos del paciente.
- `PROFESSIONAL`: consulta solo los turnos del paciente con él. La DAL aplica el filtro, no la pantalla.

## Operaciones

- `getPatientAppointmentHistory` — turnos del paciente con sus eventos, paginados.

## A conversar

- **Supuesto del equipo (29/09/2026):** la asistencia no depende del filtro de estado, porque con él dejaría de describir al paciente; sí respeta el filtro de profesional. A confirmar.
- **Decisión del equipo:** en el Inc. 2 el historial es la cronología de turnos. La atención registrada (`Encounter`) y las prescripciones entran en el Inc. 3 y completan este historial con el contenido clínico. Con la devolución del Inc. 2, el contenido es una bitácora en texto libre, no una historia clínica: [HU-25](HU-25-registrar-la-atencion.md) y [HU-26](HU-26-bitacora-del-paciente.md).
- ¿El profesional ve los turnos del paciente con otros profesionales?
  - **Decisión del equipo (28/09/2026):** no, para simplificar. Ve solo los turnos del paciente con él. Se puede ampliar en el Inc. 3, junto con la atención registrada.
