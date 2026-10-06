# HU-31 — Ingresar como paciente y ver o cancelar mis turnos

**Incremento:** 3 · **Actividad:** Portal del paciente

> Como paciente, necesito ver mis turnos y cancelar uno que no puedo cumplir sin llamar al centro, para liberar el horario a tiempo y no quedar como ausente.

## Datos

- **Acceso:** el email de la ficha del paciente y una contraseña.
- **Mis turnos:** fecha y hora, servicio, profesional y estado; próximos y pasados. De los turnos cobrados, el comprobante ([HU-24](HU-24-comprobante-de-cobro.md)).

## Validaciones

- Mesa de entradas habilita el acceso desde la ficha del paciente ([HU-17](HU-17-ficha-completa-del-paciente.md)); el sistema genera una contraseña temporal que se muestra una sola vez y que el paciente cambia al primer ingreso.
- Un paciente tiene como máximo un acceso. Dar de baja al paciente desactiva su acceso.
- El paciente cancela solo turnos propios, Programados, con al menos 24 h de anticipación, y con motivo. Valen las reglas de [HU-10](HU-10-cancelar-turno.md) (un turno con cobro vigente no se cancela).

## Comportamiento

- Al ingresar, el paciente ve **Mis turnos**, con sus próximos turnos arriba. No ve el menú del centro.
- La cancelación queda en el historial del turno con el paciente como solicitante y libera el horario en el calendario.
- El paciente no ve las notas de la atención, las observaciones administrativas ni datos de otros pacientes.

## Confirmación

- Cancelar pide confirmación con fecha, hora y profesional.

## Permisos

- `PATIENT`: solo sus propios turnos y comprobantes. Cada operación verifica en la DAL que el turno es suyo.
- `RECEPTIONIST` y `MANAGER`: habilitan y desactivan el acceso de un paciente.

## Operaciones

- `enablePatientAccess`, `disablePatientAccess` — nuevas.
- `changePassword` — nueva, para el primer ingreso.
- `listMyAppointments` — nueva, de lectura.
- `cancelAppointment` — suma el rol `PATIENT` con la regla de 24 h.

## A conversar

- Devolución del Inc. 2 (general): el portal del paciente "es importante". Responde en parte la pregunta abierta 5 de [`contexto-goat.md`](../contexto-goat.md).
- **Supuesto del equipo:** el paciente no se registra solo; el acceso lo da el centro, para asegurar que es la persona de la ficha. A confirmar.
- **Supuesto del equipo:** 24 h de anticipación mínima para cancelar desde el portal. Con menos, llama al centro. A confirmar.
- Sacar un turno desde el portal es [HU-32](HU-32-sacar-turno-desde-el-portal.md).
