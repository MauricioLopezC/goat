# HU-12 — Ver mi agenda completa

**Incremento:** 1 · **Actividad:** Calendario

> Como profesional del centro, necesito ver mi agenda con mis pacientes en orden, para saber a quién atiendo y cuándo.

## Datos

- Fecha, hora, paciente (apellido, nombre, documento), servicio y estado del turno.
- Resumen del día: cantidad de turnos programados, completados y cancelados.

## Validaciones

- Un profesional no puede acceder a la agenda de otro, ni siquiera cambiando el parámetro en la URL.

## Comportamiento

- Al ingresar, el profesional aterriza directamente en su agenda del día de hoy.
- Puede navegar a otros días y ver su semana (la vista mensual queda postergada; ver *A conversar*).
- Los turnos se muestran ordenados por hora.
- Los cancelados aparecen diferenciados o se pueden ocultar.

## Permisos

- `PROFESSIONAL`: solo su propia agenda.
- `MANAGER` y `RECEPTIONIST`: pueden ver la agenda de cualquier profesional.

## Operaciones

Solo lectura: `getProfessionalAgenda` en `src/lib/dal/appointments.ts`, llamada desde el Server Component de `/agenda` ([ADR 0001](../adr/0001-server-actions-y-capa-de-acceso-a-datos.md)).

La restricción de la URL no se resuelve en la interfaz: la pertenencia del recurso se verifica en la DAL, que compara el `professionalId` pedido contra el de la sesión y devuelve `FORBIDDEN` si no coinciden ([`acciones.md`](../acciones.md)).

## A conversar

- **Vista mensual diferida:** Para el Incremento 1 se consensuó priorizar las vistas operativas de trabajo en consultorio: vista diaria (lista cronológica detallada con ficha de turnos y timeline de franjas) y semanal (grilla horaria con franjas de disponibilidad, ausencias y feriados). La perspectiva mensual queda excluida de este incremento y postergada para iteraciones posteriores o sujeta a confirmación de necesidad con el cliente.
