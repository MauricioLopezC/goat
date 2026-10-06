# HU-24 — Emitir el comprobante de un cobro

**Incremento:** 3 · **Actividad:** Gestión de pagos

> Como mesa de entrada, necesito entregarle al paciente un comprobante con la marca del centro de lo que pagó, para que tenga constancia del cobro y el centro un número con el que encontrarlo.

## Datos

- **Encabezado:** logo y marca del centro, nombre, razón social, CUIT, dirección y teléfono.
- **Comprobante:** número correlativo, fecha y hora del cobro, y quién cobró.
- **Paciente:** nombre completo, DNI y email. Cobertura: obra social y plan si tiene, o "Particular".
- **Turno:** servicio, profesional, fecha y hora.
- **Cobro:** importe y medio de pago.
- Leyenda fija: "Comprobante no válido como factura".

## Validaciones

- El número es único y correlativo, y se asigna al cobrar. No se reutiliza aunque el cobro se anule.

## Comportamiento

- Diseño profesional, con el logo del centro (el mismo de la barra lateral) y los tokens de [`DESIGN.md`](../DESIGN.md). Es una página lista para imprimir o guardar como PDF desde el navegador, en tamaño A4.
- Los datos del centro se configuran en un solo lugar del sistema, no en cada pantalla.
- Al terminar un cobro, el mensaje de éxito ofrece **Ver comprobante**. También se abre desde el detalle del turno, desde la fila de *Turnos de hoy* ([HU-21](HU-21-cobrar-turno.md)) cuando el turno está cobrado y desde la caja ([HU-27](HU-27-cierre-de-caja.md)).
- Un cobro anulado muestra su comprobante con la marca **ANULADO**, el motivo y la fecha de anulación.

## Permisos

- `RECEPTIONIST` y `MANAGER`: ven e imprimen cualquier comprobante.
- `PATIENT`: ve los comprobantes de sus propios turnos desde el portal ([HU-31](HU-31-portal-del-paciente.md)).
- `PROFESSIONAL`: sin acceso.

## Operaciones

- `getPaymentReceipt` — nueva, de lectura.
- `registerPayment` — asigna el número de comprobante.
- `listTodayAppointments` — suma el cobro vigente, para el acceso al comprobante.

## A conversar

- Devolución del Inc. 2 (particular): el cliente pidió el comprobante para esta entrega.
- La factura electrónica y AFIP siguen fuera de alcance ([`contexto-goat.md`](../contexto-goat.md)).
- Al paciente con obra social no se le cobra ([HU-21](HU-21-cobrar-turno.md)), así que no tiene cobro ni comprobante. ¿Necesita una constancia de atención? Si el cliente la pide, se reutiliza este diseño sin importe.
