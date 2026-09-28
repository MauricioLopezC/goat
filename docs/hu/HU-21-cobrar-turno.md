# HU-21 — Cobrar un turno en el mostrador

**Incremento:** 2 · **Actividad:** Gestión de pagos

> Como mesa de entrada, necesito registrar el cobro de un turno particular y la autorización de la obra social cuando el paciente llega, para saber qué se cobró, a quién y cómo, y qué turnos se atendieron con orden autorizada.

## Datos

- **Cobro (paciente particular):** medio de pago, obligatorio. El monto lo calcula el sistema: es el valor del servicio.
- **Autorización (paciente con obra social):** número de autorización, obligatorio cuando el servicio requiere orden médica.
- **Registrados por el sistema:** usuario, fecha y hora del cobro y de la autorización.

## Validaciones

- El cobro y la autorización se registran sobre un turno Programado del día de hoy o sobre un turno Completado.
- Solo se cobra a pacientes particulares. A un paciente con obra social no se le cobra en este incremento.
- La autorización solo se registra si el paciente tiene obra social y el servicio requiere orden.
- Un turno tiene como máximo un cobro vigente.
- El servicio tiene que tener valor cargado ([HU-20](HU-20-aranceles-y-medios-de-pago.md)); si no, el sistema avisa y no cobra.
- El medio de pago tiene que estar activo. Un cobro se paga con un solo medio.

## Comportamiento

- El detalle del turno ofrece **Cobrar** si el paciente es particular, o **Registrar autorización** si tiene obra social y el servicio requiere orden.
- El cobro guarda el monto del momento, separado del valor del servicio: si después cambia el valor, el cobro no cambia.
- El turno muestra su estado en el detalle, en el calendario y en el historial del paciente ([HU-18](HU-18-historial-de-turnos-del-paciente.md)): pendiente de cobro o cobrado (particular); pendiente de autorización o autorizado (obra social con orden).
- **Anular un cobro:** si se cargó mal, se anula con motivo obligatorio; no se borra. Queda quién lo anuló y cuándo, y el turno se puede volver a cobrar.
- Un turno con cobro vigente no se cancela ni se reprograma: primero se anula el cobro.
- Al dar el turno ([HU-09](HU-09-asignar-turno.md)), si el servicio requiere orden y el paciente tiene obra social, se avisa: "Recordale al paciente traer la orden".

## Confirmación

- Antes de cobrar, muestra el monto y el medio elegido.
- Mensaje de éxito con el monto cobrado o el número de autorización registrado.
- Anular pide confirmación.

## Permisos

- `RECEPTIONIST` y `MANAGER`: cobran, anulan y registran autorizaciones.
- `PROFESSIONAL`: sin acceso.

## Operaciones

- `registerPayment` — errores nuevos a documentar en `acciones.md`: servicio sin valor, turno ya cobrado, paciente con obra social.
- `voidPayment` — anulación con motivo (`REASON_REQUIRED`).
- `registerAuthorization` — número de autorización del turno.

## A conversar

- **Supuesto del equipo:** se cobra al llegar, un solo medio de pago por cobro, sin pagos parciales. A confirmar.
- ¿Qué se le cobra a un paciente con obra social?
  - **Decisión del equipo (28/09/2026):** nada en el Inc. 2. Solo se registra la autorización cuando el servicio requiere orden. El coseguro queda para el Inc. 3.
- **Supuesto del equipo:** la orden o autorización se pide por turno, solo cuando el servicio requiere orden y hay obra social, y se registra al llegar el paciente. A confirmar.
- Devoluciones de dinero: fuera del Inc. 2.
