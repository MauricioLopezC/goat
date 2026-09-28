# HU-21 — Cobrar un turno en el mostrador

**Incremento:** 2 · **Actividad:** Gestión de pagos

> Como mesa de entrada, necesito registrar el cobro de un turno cuando el paciente llega, con el medio de pago que usa, para saber qué se cobró, a quién y cómo, sin planillas.

## Datos

- **Obligatorios:** medio de pago.
- **Obligatorio si corresponde:** número de autorización de la obra social, cuando el servicio requiere orden médica y el paciente tiene obra social.
- **Calculados por el sistema:** valor de la prestación, parte que cubre la obra social y monto que paga el paciente.
- **Registrados por el sistema:** usuario, fecha y hora del cobro.

## Validaciones

- Se cobra un turno Programado del día de hoy, o un turno Completado.
- Un turno tiene como máximo un cobro vigente.
- El servicio tiene que tener valor cargado ([HU-20](HU-20-aranceles-y-medios-de-pago.md)); si no, el sistema avisa y no cobra.
- El medio de pago tiene que estar activo.
- Un cobro se paga con un solo medio de pago.
- Sin número de autorización, cuando corresponde, no se cobra.

## Comportamiento

- **Particular:** paga el valor de la prestación.
- **Obra social:** paga el coseguro de su plan. La diferencia es la parte que cubre la obra social; se registra, pero no se le factura a nadie (fuera de alcance).
- El cobro guarda por separado el valor de la prestación, lo que cubre la obra social y lo que paga el paciente, con los montos del momento.
- El turno muestra su estado de pago (pendiente o cobrado) en el detalle, en el calendario y en el historial del paciente ([HU-18](HU-18-historial-de-turnos-del-paciente.md)).
- **Anular un cobro:** si se cargó mal, se anula con motivo obligatorio; no se borra. Queda quién lo anuló y cuándo, y el turno se puede volver a cobrar.
- Un turno con cobro vigente no se cancela ni se reprograma: primero se anula el cobro.
- Al dar el turno ([HU-09](HU-09-asignar-turno.md)), si el servicio requiere orden y el paciente tiene obra social, se avisa: "Recordale al paciente traer la orden".

## Confirmación

- Antes de guardar, muestra el desglose: valor, cobertura y monto a pagar, y el medio elegido.
- Mensaje de éxito con el monto cobrado.
- Anular pide confirmación.

## Permisos

- `RECEPTIONIST` y `MANAGER`: cobran y anulan.
- `PROFESSIONAL`: sin acceso.

## Operaciones

- `getPaymentQuote` — desglose de lo que corresponde cobrar por un turno.
- `registerPayment` — errores nuevos a documentar en `acciones.md`: servicio sin valor, turno ya cobrado, falta el número de autorización.
- `voidPayment` — anulación con motivo (`REASON_REQUIRED`).

## A conversar

- **Supuesto del equipo:** se cobra al llegar, un solo medio de pago por cobro, sin pagos parciales. A confirmar.
- **Supuesto del equipo:** la orden o autorización se pide por turno y solo cuando el servicio requiere orden y hay obra social. Se registra al cobrar, que es cuando el paciente la presenta. A confirmar.
- Devoluciones de dinero: fuera del Inc. 2.
