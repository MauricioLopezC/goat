# HU-26 — Ver la bitácora del paciente

**Incremento:** 3 · **Actividad:** Atención e historial

> Como profesional, necesito ver en una sola lista cuándo vino el paciente, cuándo faltó o canceló y qué se anotó en cada visita, para entender su recorrido en el centro antes de atenderlo.

## Datos

Amplía el historial de [HU-18](HU-18-historial-de-turnos-del-paciente.md). Por turno, además de lo que ya muestra:

- Atención registrada ([HU-25](HU-25-registrar-la-atencion.md)): notas, indicaciones y profesional autor.
- Cancelación con su motivo y quién la pidió, destacada.

## Validaciones

- Sin turnos, se muestra un mensaje explícito (como en HU-18).

## Comportamiento

- Mantiene la lista de HU-18: del más reciente al más antiguo, próximos separados de pasados, de a 10, con filtro por estado y por profesional.
- Cada turno pasado muestra en una línea su resultado según el estado: vino (Completado), faltó (Vencido) o canceló (Cancelado). Debajo, el texto de la atención si el usuario puede verlo.
- Filtro **Solo con atención registrada**, para leer la bitácora clínica de corrido.
- El profesional llega a la bitácora desde su agenda y desde el detalle del turno.

## Permisos

- `PROFESSIONAL`: ve la bitácora completa del paciente, de todos los profesionales, si tiene o tuvo al menos un turno con él. La DAL lo verifica.
- `RECEPTIONIST` y `MANAGER`: ven la asistencia, las cancelaciones y si hay atención registrada, pero no las notas ni las indicaciones.

## Operaciones

- `getPatientAppointmentHistory` — suma la atención y aplica qué campos ve cada rol.

## A conversar

- Devolución del Inc. 2 (general): "cuándo vino, cuándo canceló un turno y, cuando vino, qué observaciones le pudo haber hecho".
- La asistencia es el estado del turno: Completado significa que el paciente vino ([HU-11](HU-11-calendario-del-centro.md)). No hay una marca de llegada aparte (decisión del equipo, 05/10/2026).
- **Supuesto del equipo:** el profesional ve también las atenciones de otros colegas, porque en un policonsultorio el traumatólogo necesita saber qué hizo el kinesiólogo. Amplía la decisión de HU-18 (solo sus turnos). A confirmar.
- **Supuesto del equipo:** mesa de entradas y el gerente no leen las notas de la atención, porque son datos clínicos. A confirmar.
