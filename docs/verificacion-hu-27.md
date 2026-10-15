# Verificación — HU-27 · Cerrar la caja del día e historial

Documento de verificación de los criterios de aceptación, arqueo de caja, autorizaciones en la DAL, concurrencia, sincronización en vivo e historial de [HU-27](hu/HU-27-cierre-de-caja.md), conforme al plan de mitigación de riesgos del [Incremento 3](incrementos/3.md).

## 1. Dónde entrar y con qué rol

- **Mesa de entradas (`RECEPTIONIST`):** accede a **Caja** (`/cash`) desde el menú lateral. Puede consultar la caja en vivo de hoy, revisar totales discriminados por medio de pago y profesional, acceder a los comprobantes de cobro y realizar el arqueo y cierre diario. Puede consultar y cerrar cajas de días anteriores pendientes de cierre. No tiene acceso al historial histórico de cajas cerradas de días pasados (`/cash/history`).
- **Gerente (`MANAGER`):** accede a **Caja** (`/cash`) y a **Historial de caja** (`/cash/history`). Puede realizar arqueos y cierres, ver cualquier caja cerrada histórica y es el único rol autorizado a anular cobros de una caja ya cerrada (ajuste posterior).
- **Profesional (`PROFESSIONAL`):** no tiene acceso a `/cash` ni `/cash/history` (rechazo `FORBIDDEN` en DAL y en middleware de rutas). Su rendición de honorarios corresponde a [HU-28](hu/HU-28-rendicion-por-profesional.md).

Los usuarios de demo están en `CONTRIBUTING.md` (recepción: `mesa@goat.local`, gerencia: `gerente@goat.local`, contraseña: `goat1234`).

## 2. Recorrido manual guiado

1. **Caja del día en vivo (`/cash`):**
   - Ingresar como `RECEPTIONIST` o `MANAGER` y abrir `/cash`.
   - Comprobar las métricas superiores: cantidad de cobros del día, total cobrado y efectivo esperado por sistema.
   - Revisar las tarjetas de desglose: total cobrado por cada medio de pago activo y total por cada profesional por los turnos particulares atendidos.
   - En la tabla de cobros del día, abrir el comprobante de un cobro con el botón de recibo para validar su enlace con [HU-24](hu/HU-24-comprobante-de-cobro.md).
2. **Arqueo y cierre de caja:**
   - Presionar **Cerrar caja**.
   - Cargar un importe de efectivo contado diferente al esperado: comprobar que el diálogo calcula en tiempo real la diferencia (+ sobrante, - faltante) y exige obligatoriamente ingresar observaciones justificatorias.
   - Ingresar la justificación y confirmar: el diálogo advierte que la caja se cerrará de forma definitiva, que no se podrán registrar nuevos cobros para esa fecha y que solo el gerente podrá anular cobros como ajuste posterior.
   - Confirmar el cierre: la pantalla pasa a estado cerrada, mostrando la fecha y hora exacta del cierre, el usuario autor, el arqueo y la diferencia.
3. **Bloqueo post-cierre y recobros:**
   - Intentar registrar un nuevo cobro para la fecha cerrada: la DAL rechaza con error `CASH_CLOSED`.
   - Intentar anular un cobro desde el rol `RECEPTIONIST`: la acción es rechazada con `FORBIDDEN`.
4. **Ajustes posteriores de gerencia:**
   - Ingresar como `MANAGER` y entrar a la caja cerrada.
   - Anular un cobro indicando el motivo: la caja permanece cerrada (no se reabre), el cobro pasa a la sección de **Ajustes posteriores al cierre** con su autor, fecha y motivo, y se exponen los **Totales corregidos** junto a los originales.
   - El turno anulado queda habilitado para volver a cobrarse en una fecha con caja abierta.
5. **Historial de cajas cerradas (`/cash/history`):**
   - Como `MANAGER`, acceder a `/cash/history`.
   - Visualizar la tabla paginada de cierres históricos ordenados por fecha descendente, con sus importes originales, conteos, diferencias y cantidad de ajustes posteriores.
   - Ingresar como `RECEPTIONIST` a `/cash/history` y comprobar que el acceso es denegado (`FORBIDDEN`).
6. **Sincronización en vivo entre pestañas y sesiones:**
   - Abrir `/cash` en dos navegadores o pestañas (por ejemplo, recepción y gerencia).
   - Registrar un cobro o anular un pago en una pestaña: comprobar que la otra pestaña refresca automáticamente la información vía BroadcastChannel/storage y polling periódico, tanto con caja abierta como cerrada.

## 3. Matriz de criterios de aceptación y verificación técnica

| Criterio (HU-27) | Implementación | Verificación |
|---|---|---|
| Cantidad y total del día en vivo | `getCashSummary` en `src/lib/dal/cash.ts` | `scripts/verify-payments.ts` (bloque 12) |
| Desglose por medio de pago y por profesional | Agrupaciones Decimal en `getCashSummary` | `scripts/verify-payments.ts` (bloque 12) |
| Cobros anulados durante el día | Filtrado por `voidedAt` dentro de la fecha local | `scripts/verify-payments.ts` (bloque 12, H4) |
| Efectivo contado obligatorio, observaciones obligatorias si hay diferencia | `closeCashSchema` en `src/lib/validation/cash.ts` y validación en `closeCash` | `tests/cash.test.ts` y `scripts/verify-payments.ts` (bloque 12) |
| Cierre único por fecha, inmutable con foto del momento | Transacción Serializable en `closeCash` con creación de `CashClosing` | `scripts/verify-payments.ts` (bloque 12, DUPLICATE) |
| Bloqueo de cobros post-cierre | `registerPayment` verifica `cashClosing` y rechaza con `CASH_CLOSED` | `scripts/verify-payments.ts` (bloque 12, H1) |
| Anulación post-cierre exclusiva de gerencia | `voidPayment` restringe cobros con `cashClosingId !== null` a `Role.MANAGER` | `scripts/verify-payments.ts` (bloque 12, H2) |
| Ajustes posteriores y cálculo de totales corregidos | `CashSummary.subsequentAdjustments` y `correctedTotals` restando solo ajustes | `tests/cash.test.ts` y `scripts/verify-payments.ts` (bloque 12) |
| Inmunidad del cálculo de efectivo ante renombrado (R2) | `isCashPayment` prioriza flags persistidos en `Payment` y `PaymentMethod` | `tests/cash.test.ts` y `scripts/verify-payments.ts` (bloque 12, R2) |
| Orden temporal de ajuste posterior garantizado (R1) | `voidPayment` evalúa `voidedAt` dentro de la transacción y garantiza `voidedAt > closedAt` | `scripts/verify-payments.ts` (bloque 12 y 16, R1) |
| Sincronización continua en vivo (R3) | `CashAutoRefresh` activo para cajas abiertas y cerradas | `src/app/(app)/cash/cash-auto-refresh.tsx` |
| Permisos por rol en UI y DAL | `requirePageRole` y `assertRole` en `cash.ts` y `route-access.ts` | `tests/navigation.test.ts` y `scripts/verify-payments.ts` |

## 4. Concurrencia y mitigación de carreras

1. **H1 — Carrera entre cobro y cierre:**
   - *Riesgo:* Un cobro se confirma justo después de que el cierre tomó la foto, quedando fuera de la rendición y sin vincular a la caja.
   - *Solución:* Transacciones `Serializable` y verificación de `cashClosing` dentro de `registerPayment`. Si la caja se cierra concurrentemente, el cobro aborta con `CASH_CLOSED`.
2. **H2 — Carrera entre anulación de recepcionista y cierre:**
   - *Riesgo:* Recepcionista inicia la anulación de un cobro abierto, el cierre se confirma concurrentemente, y la anulación se aplica sin autorización de gerencia.
   - *Solución:* `voidPayment` condiciona el `UPDATE` a `cashClosingId: null` para roles distintos de `MANAGER`. Si el cierre confirma primero, la anulación no actualiza registros y arroja `FORBIDDEN`.
3. **R1 — Carrera entre anulación de gerencia y cierre:**
   - *Riesgo:* Gerencia anula concurrentemente con el cierre; si el timestamp de anulación se evaluaba previo a la transacción, quedaba `voidedAt < closedAt`, ocultando el cobro de los ajustes posteriores.
   - *Solución:* El instante efectivo `voidedAt` se calcula dentro del intento transaccional y se garantiza `voidedAt > closedAt` para cobros cerrados.
4. **R2 — Protección del efectivo ante renombrado de medios de pago:**
   - *Riesgo:* Renombrar un medio de débito a un nombre que contenga "efectivo" alteraba retroactivamente el efectivo esperado y corregido si el flag `isCash = false` no se respetaba de forma temprana.
   - *Solución:* `isCashPayment` evalúa con máxima prioridad el valor booleano de `Payment.isCash` (tanto `true` como `false`), preservando la inmutabilidad histórica.

## 5. Comandos reproducibles

- `npm run check`: verifica formato Prettier, linter ESLint, validación de tipos TypeScript, validación de esquema Prisma y suite completa de pruebas unitarias (`tests/cash.test.ts`, `tests/navigation.test.ts`, etc.).
- `npm run test:payments:db`: suite de integración en PostgreSQL que ejecuta los 16 bloques de prueba de HU-21, HU-24 y HU-27 con datos aislados por UUID y limpieza en `finally`.
