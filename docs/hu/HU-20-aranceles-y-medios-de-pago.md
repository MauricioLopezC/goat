# HU-20 — Configurar valores y medios de pago

**Incremento:** 2 · **Actividad:** Gestión de pagos

> Como gerente, necesito cargar el valor de cada servicio y los medios de pago que acepta el centro, para que en el mostrador se cobre lo que corresponde sin calcularlo a mano.

## Datos

- **Servicio:** valor de la prestación, en pesos.
- **Medio de pago:** nombre y estado (activo o inactivo). El seed trae efectivo, tarjeta de débito, tarjeta de crédito y transferencia.

## Validaciones

- El valor es un monto mayor o igual a cero, con dos decimales como máximo.
- No puede haber dos medios de pago con el mismo nombre.
- No se desactiva el último medio de pago activo.

## Comportamiento

- El valor se carga en el formulario de servicios de [HU-06](HU-06-catalogo-de-servicios.md) y se ve en su listado.
- Los medios de pago se agregan, se renombran y se activan o desactivan; no se borran. Uno inactivo no se ofrece al cobrar, pero sigue en los cobros ya hechos.
- Cambiar un valor no modifica los cobros ya registrados: cada cobro guarda el monto del momento.

## Permisos

- `MANAGER`: configura.
- `RECEPTIONIST`: consulta.
- `PROFESSIONAL`: sin acceso.

## Operaciones

- `createService`, `updateService` — suman el valor.
- `listPaymentMethods`, `createPaymentMethod`, `updatePaymentMethod` — medios de pago.

## A conversar

- D-05: el centro necesita varios medios de pago.
- ¿Se configura el coseguro de las obras sociales?
  - **Decisión del equipo (28/09/2026):** no. El coseguro sale del Inc. 2; el mapa ya ubica la liquidación de coseguro en el Inc. 3.
