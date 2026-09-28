# HU-20 — Configurar valores, coseguros y medios de pago

**Incremento:** 2 · **Actividad:** Gestión de pagos

> Como gerente, necesito cargar el valor de cada servicio, el coseguro de cada plan de obra social y los medios de pago que acepta el centro, para que en el mostrador se cobre lo que corresponde sin calcularlo a mano.

## Datos

- **Servicio:** valor de la prestación, en pesos.
- **Plan de obra social:** coseguro, en pesos (monto fijo, igual para todos los servicios).
- **Medio de pago:** nombre y estado (activo o inactivo). El seed trae efectivo, tarjeta de débito, tarjeta de crédito y transferencia.

## Validaciones

- Valor y coseguro son montos mayores o iguales a cero, con dos decimales como máximo.
- No puede haber dos medios de pago con el mismo nombre.
- No se desactiva el último medio de pago activo.

## Comportamiento

- El valor se carga en el formulario de servicios de [HU-06](HU-06-catalogo-de-servicios.md).
- El coseguro se carga en una pantalla con las obras sociales y sus planes.
- Los medios de pago se agregan, se renombran y se activan o desactivan; no se borran. Uno inactivo no se ofrece al cobrar, pero sigue en los cobros ya hechos.
- Cambiar un valor o un coseguro no modifica los cobros ya registrados: cada cobro guarda los montos del momento.

## Permisos

- `MANAGER`: configura.
- `RECEPTIONIST`: consulta.
- `PROFESSIONAL`: sin acceso.

## Operaciones

- `createService`, `updateService` — suman el valor.
- `listInsurancePlans`, `updateInsurancePlanCopay` — coseguro por plan.
- `listPaymentMethods`, `createPaymentMethod`, `updatePaymentMethod` — medios de pago.

## A conversar

- D-05: el centro necesita varios medios de pago.
- **Supuesto del equipo:** el coseguro depende del plan, no del paciente ni del servicio. Hoy se guarda por paciente; pasa al plan. A confirmar.
- **Supuesto del equipo:** el alta y baja de obras sociales y planes sigue en el seed; acá solo se edita el coseguro. A confirmar.
