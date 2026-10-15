# Verificación — HU-31 · Ingresar como paciente y ver o cancelar mis turnos

Documento de verificación de los criterios de aceptación, autorización en la DAL y aislamiento de datos de [HU-31](hu/HU-31-portal-del-paciente.md), conforme al plan de mitigación de riesgos del [Incremento 3](incrementos/3.md).

## 1. Comandos de verificación automatizada

| Comando | Qué verifica |
| --- | --- |
| `npm test` | Pruebas unitarias de `tests/portal.test.ts` (anticipación mínima de 24 h para cancelar, estados habilitados y generador de contraseña temporal) y `tests/navigation.test.ts` (permisos de rutas `/portal/*` vs rutas internas del centro para el rol `PATIENT`). |
| `npm run test:portal:db` | Verificación de integración contra PostgreSQL local (`scripts/verify-portal.ts`): habilitación/reutilización/deshabilitación de acceso, cambio obligatorio de clave temporal, sincronización de email/nombre/teléfono al editar el paciente, listado de turnos propios sin filtración de notas ni historias clínicas, regla de 24 h en servidor y aislamiento de turnos y comprobantes entre pacientes. |
| `npm run check` | Formato (`prettier`), lint (`eslint`), chequeo de tipos (`next typegen && tsc --noEmit`), validación de schema (`prisma validate`) y suite de pruebas unitarias (`npm test`). |

## 2. Matriz de criterios de aceptación y aislamiento

| Criterio (HU-31) | Implementación | Verificación |
| --- | --- | --- |
| Habilitar acceso desde la ficha del paciente (`/patients/[id]`) por Mesa de Entradas o Gerente, creando o reutilizando `User` con `role = PATIENT` y `mustChangePassword = true` | `enablePatientAccess` en `src/lib/dal/patients.ts` + tarjeta `PortalAccessCard` con diálogo de única visualización | `scripts/verify-portal.ts` (bloque 1) |
| Cambio obligatorio de contraseña temporal en el primer ingreso antes de operar en el portal | `signIn` redirige a `/portal/change-password` cuando `mustChangePassword = true`; `/portal` y `/portal/payments/[id]/receipt` redirigen a `/portal/change-password` si sigue en `true`; `changePassword` valida la clave actual y limpia `mustChangePassword` | `scripts/verify-portal.ts` (bloque 1) |
| Deshabilitar acceso al portal sin borrar el paciente ni su historial | `disablePatientAccess` en `src/lib/dal/patients.ts` + `getSession`/`signIn` verifican `user.active` y `patient.active` | `scripts/verify-portal.ts` (bloque 2) |
| Sincronización de datos del `User` vinculado al editar el paciente | `updatePatient` en `src/lib/dal/patients.ts` valida unicidad de `email` en `User` y sincroniza `email`, `firstName`, `lastName` y `phone` | `scripts/verify-portal.ts` (bloque 2) |
| El paciente solo accede a `/portal/*` y no ve el menú del centro | Grupo de rutas `src/app/(portal)/layout.tsx` con `requirePageRole(Role.PATIENT)` sin `AppSidebar`; reglas en `src/lib/route-access.ts` | `tests/navigation.test.ts` |
| «Mis turnos» muestra próximos (`SCHEDULED` futuros, ascendente) y anteriores (descendente), sin notas internas ni atención clínica | `listMyAppointments` en `src/lib/dal/appointments.ts` usa `select` explícito sin `notes`, `encounter` ni `events` | `scripts/verify-portal.ts` (bloque 3) |
| Cancelación por el paciente con confirmación, motivo obligatorio, trazabilidad (`requestedBy = "El paciente"`) y bloqueo si faltan menos de 24 h | `cancelAppointment` en `src/lib/dal/appointments.ts` verifica propiedad (`appointment.patient.userId === actor.id`) y `hasMinimumCancellationNotice(startsAt, now)` (`CANCELLATION_WINDOW_EXPIRED`) | `tests/portal.test.ts` y `scripts/verify-portal.ts` (bloque 3) |
| Descarga e impresión de comprobante de pago propio; bloqueo de comprobantes ajenos | `/portal/payments/[id]/receipt` consume `getPaymentReceipt(paymentId, actor)`, que verifica `payment.appointment.patient.userId === actor.id` | `scripts/verify-portal.ts` (bloque 3) |
