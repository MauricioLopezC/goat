# Verificación de HU-21 — Cobrar un turno en el mostrador

## Dónde entrar y con qué rol

- **Mesa de entradas (`RECEPTIONIST`) o gerente (`MANAGER`):** abrir un turno desde el **Calendario** (`/calendar`). El detalle del turno (`/appointments/[id]`) muestra la tarjeta **Cobro** o **Autorización de la obra social** con sus acciones.
- **Profesional (`PROFESSIONAL`):** abre sus turnos desde **Mi agenda**, pero no ve cobros ni autorizaciones, y la DAL le rechaza cualquier operación de cobro.
- Los valores de los servicios y los medios de pago se configuran en [HU-20](hu/HU-20-aranceles-y-medios-de-pago.md) (**Servicios** y **Medios de pago**).

Los usuarios de demo están en `CONTRIBUTING.md`. En una base recién sembrada (`npx prisma migrate reset`), el miércoles de la semana anterior tiene un turno particular Completado y cobrado en efectivo y otro Completado pendiente de cobro. El lunes de la semana anterior tiene un turno de kinesiología con obra social ya autorizado. Los turnos Programados de hoy sirven para probar el cobro y la autorización en vivo.

## Recorrido manual

1. Como mesa de entradas, abrir el **Calendario** en la vista día de hoy. Los turnos Programados de hoy y los Completados muestran la marca: pendiente de cobro o cobrado (ícono de pesos), pendiente de autorización o autorizado (ícono de documento). Los turnos futuros no la muestran.
2. Abrir un turno de hoy de un paciente particular. La tarjeta **Cobro** dice *Pendiente de cobro* y muestra el valor del servicio. Pulsar **Cobrar**, elegir el medio de pago y verificar que antes de confirmar se ven el monto y el medio. Pulsar **Confirmar cobro**: el mensaje de éxito muestra el monto cobrado.
3. En ese mismo turno, comprobar que no aparece **Cancelar turno** ni **Marcar vencido**, y que el texto indica que primero hay que anular el cobro.
4. Pulsar **Anular cobro**. Sin motivo no deja confirmar. Con motivo, el cobro pasa a *Cobros anulados*, con quién lo anuló, cuándo y por qué. El turno vuelve a *Pendiente de cobro* y se puede cobrar de nuevo.
5. Como gerente, bajar el valor del servicio en **Servicios**. El cobro ya registrado conserva su monto.
6. Abrir un turno de hoy de un paciente con obra social cuyo servicio requiere orden (por ejemplo, una sesión de kinesiología). La tarjeta dice *Pendiente de autorización*. Pulsar **Registrar autorización**, cargar el número y guardar: el mensaje muestra el número registrado. **Corregir autorización** cambia el número, y el anterior queda en el **Historial** del turno.
7. Un turno de obra social sin orden no muestra tarjeta ni botón **Cobrar**. Un turno de mañana muestra el estado, pero no permite cobrar ni autorizar.
8. En **Nuevo turno**, elegir un paciente con obra social y un servicio que requiere orden: aparece "Recordale al paciente traer la orden".
9. Ingresar como profesional y abrir uno de sus turnos cobrados: no se ve la tarjeta de cobro.
10. Para el caso sin valor, como gerente dejar un servicio sin valor y abrir un turno de hoy de un particular con ese servicio: aparece el aviso y no hay botón **Cobrar**.

## Criterios y evidencia

| # | Criterio de HU-21 | Verificación |
|---|---|---|
| 1 | Cobro y autorización solo en turnos Programados de hoy (hora de Argentina) o Completados | Unitaria de `isChargeable` (incluye el cambio de día a las 21 h UTC) y PostgreSQL |
| 2 | Solo se cobra a particulares; la autorización solo con obra social y orden | PostgreSQL: `PATIENT_HAS_HEALTH_INSURANCE`, `AUTHORIZATION_NOT_REQUIRED` |
| 3 | Máximo un cobro vigente, incluso con dos cobros a la vez | PostgreSQL: cobro repetido y cobros concurrentes (índice parcial + transacción serializable) |
| 4 | Servicio sin valor avisa y no cobra; medio inactivo rechazado | PostgreSQL: `SERVICE_WITHOUT_PRICE`, `VALIDATION`; aviso en el detalle |
| 5 | El monto queda fijo aunque cambie el valor del servicio | PostgreSQL |
| 6 | Anular exige motivo, deja traza y permite volver a cobrar | PostgreSQL y recorrido de navegador |
| 7 | Con cobro vigente no se cancela ni se vence; sí se completa | PostgreSQL, incluido cobrar y cancelar a la vez; botones ocultos en el detalle |
| 8 | Corregir la autorización deja el número anterior en el historial | PostgreSQL (`AppointmentEvent` `UPDATED`) |
| 9 | Estado visible en detalle y calendario; el profesional no lo ve | PostgreSQL (`getPaymentStates`, permisos) y recorrido |
| 10 | Aviso de la orden al dar el turno | Recorrido de navegador |
| 11 | Estado en el historial del paciente (HU-18) | **PENDIENTE**: HU-18 no está en `master`; debe usar `paymentState` de `src/lib/payments.ts` |
| 12 | No se reprograma con cobro vigente (HU-16) | **PENDIENTE**: HU-16 no está en `master`; `rescheduleAppointment` debe llamar a `assertNoActivePayment` |

## Comandos reproducibles

- `npm run check`: formato, lint, tipos, validación Prisma y pruebas unitarias (incluye `tests/payments.test.ts`).
- `npm run test:payments:db`: pruebas sobre PostgreSQL local migrado. Crea sus propios usuarios, servicios, medios de pago, profesional, pacientes y turnos, identificados con UUID, y los borra en `finally`. Rechaza bases remotas y `NODE_ENV=production`.
- `npm run test:appointments:db`: sigue en verde con las guardas nuevas de cancelar y vencer.
