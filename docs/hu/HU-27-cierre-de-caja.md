# HU-27 — Cerrar la caja del día

**Incremento:** 3 · **Actividad:** Gestión de pagos

> Como mesa de entrada, necesito cerrar la caja al final del día con lo cobrado por medio de pago y por profesional, para contar el efectivo contra lo que dice el sistema y entregarle al gerente una rendición clara.

## Datos

- **Calculados:** cantidad de cobros y total del día; total por medio de pago; total por profesional (por los turnos que atendió); cobros anulados en el día.
- **Obligatorio al cerrar:** efectivo contado.
- **Opcional:** observaciones.
- **Registrados por el sistema:** quién cerró, fecha y hora, y la diferencia entre el efectivo contado y el efectivo cobrado.

## Validaciones

- Una caja por día para todo el centro. Se cierra una sola vez.
- Se cierra el día de hoy o un día anterior que haya quedado abierto.
- Si la diferencia no es cero, las observaciones son obligatorias.
- Un cobro de una caja cerrada solo lo anula el gerente, con motivo.

## Comportamiento

- La pantalla **Caja** muestra la caja de hoy en vivo: los totales se actualizan con cada cobro y cada anulación, y la lista de cobros abre su comprobante ([HU-24](HU-24-comprobante-de-cobro.md)).
- **Cerrar caja** pide el efectivo contado, muestra la diferencia y confirma.
- Un cobro de un turno de un día anterior cae en la caja del día en que se cobra, no en la del turno.
- **Corrección del gerente:** si anula un cobro de una caja cerrada, la caja no se reabre: muestra la anulación como ajuste posterior, con quién, cuándo y por qué, y el total corregido junto al original. El turno se puede volver a cobrar, y ese cobro cae en la caja del día.
- Las cajas cerradas quedan en una lista por fecha, con su resumen e impresión.
- Arriba de *Turnos de hoy* se avisa si hay días anteriores con la caja sin cerrar.

## Confirmación

- Antes de cerrar, muestra totales, efectivo contado y diferencia, y avisa que después solo el gerente podrá anular cobros del día.

## Permisos

- `RECEPTIONIST` y `MANAGER`: ven la caja y la cierran.
- `MANAGER`: consulta las cajas cerradas de cualquier fecha y anula cobros de una caja cerrada.
- `PROFESSIONAL`: sin acceso (su rendición es [HU-28](HU-28-rendicion-por-profesional.md)).

## Operaciones

- `getCashSummary` — nueva, de lectura.
- `closeCash` — nueva.
- `listCashClosings` — nueva.
- `voidPayment` — sobre un cobro de una caja cerrada, solo `MANAGER`.

## A conversar

- Devolución del Inc. 2 (general): "el cierre de caja por profesional, que quede mejor".
- **Supuesto del equipo:** una sola caja para el centro, no una por recepcionista ni por profesional; el detalle por profesional va dentro de la caja. A confirmar.
- **Decisión del equipo (05/10/2026):** el gerente corrige un cobro mal cargado después del cierre.
