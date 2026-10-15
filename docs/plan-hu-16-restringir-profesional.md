# Plan de implementación — HU-16: conservar el profesional al reprogramar

## 1. Objetivo y alcance

Impedir que un usuario con rol `PROFESSIONAL` transfiera un turno propio a otro profesional al reprogramarlo. Puede cambiar fecha y horario dentro de su propia agenda. `RECEPTIONIST` y `MANAGER` conservan la posibilidad de elegir otro profesional habilitado para el mismo servicio.

Este documento conserva el plan original. La ejecución y sus verificaciones se registran al final.

## 2. Verificación y actualización del repositorio

- Verificación realizada el 14/10/2026, antes de redactar el plan.
- El árbol de trabajo estaba limpio, en `fix/leyenda-calendario-fondo-fila`.
- Se ejecutó `git fetch origin --prune` contra `https://github.com/MauricioLopezC/goat.git`.
- La rama inicial estaba cuatro commits detrás de `origin/master`, sin commits exclusivos. Su referencia remota ya había sido eliminada.
- Se creó `docs/plan-hu-16-profesional` desde `origin/master`, incorporando todos los cambios publicados en la rama principal sin modificar ni descartar trabajo local.
- Base del plan: `11ed84d03f95343c5dc9dc6a6843a8f7da35f957`, igual a `origin/master` después del fetch.

### Cambios nuevos revisados

Los cuatro commits incorporan el merge del arreglo de la leyenda del calendario y HU-26, bitácora del paciente, con su corrección de acceso restringido. El diferencial respecto del punto inicial afecta nueve archivos: documentación de acciones, consulta y validación de la bitácora, página del paciente, filtros, historial y pruebas.

La bitácora ahora contempla restricciones de acceso y presentación de turnos ajenos. La mejora propuesta debe conservar esa política y la trazabilidad de las reprogramaciones. Estos cambios no corrigen el selector ni la autorización de destino de HU-16.

## 3. Diagnóstico del comportamiento actual

### Historia y contrato

- `docs/hu/HU-16-reprogramar-turno.md` permite al profesional reprogramar turnos propios, pero su criterio 3 permite elegir otro profesional sin distinguir roles.
- La ficha `rescheduleAppointment` de `docs/acciones.md` exige pertenencia del turno al actor profesional, pero tampoco restringe el destino.
- La mejora solicitada define esa distinción; debe quedar escrita antes de implementar.

### Página del servidor

Archivo: `src/app/(app)/appointments/[id]/reschedule/page.tsx`.

- Autoriza los tres roles y obtiene el turno mediante `getAppointment(appointmentId, actor)`.
- Consulta directamente con Prisma todos los profesionales activos habilitados para el servicio y con franjas compatibles.
- Acepta `professionalId` desde la URL si pertenece a esa lista, sin distinguir el rol.
- Consulta fechas y horarios con ese profesional seleccionado.
- Muestra una instrucción que invita a elegir otro profesional a todos los usuarios.

### Formulario

Archivo: `src/app/(app)/appointments/[id]/reschedule/reschedule-form.tsx`.

- Muestra un selector cuando hay más de un profesional.
- Envía `newProfessionalId` cuando el seleccionado difiere del actual.
- Conserva el profesional seleccionado en los enlaces de fechas y paginación.
- El mensaje de profesional único depende de la cantidad de opciones; no expresa una restricción por permisos.

### Mutación y autorización

Archivo: `src/lib/dal/appointments.ts`, función `rescheduleAppointment`.

- Verifica rol, entrada y pertenencia mediante `appointment.professional.userId === actor.id`.
- Calcula el destino con `data.newProfessionalId ?? appointment.professionalId`.
- No rechaza que un profesional indique como destino a otro profesional.
- La actualización y el evento se escriben en una transacción `Serializable`, con reintentos por concurrencia.

La Server Action en `src/app/(app)/appointments/[id]/actions.ts` ya valida sesión, rol y entrada mediante `defineAction` y delega en la DAL. Ocultar el selector por sí solo dejaría disponible la transferencia mediante una solicitud manipulada.

## 4. Regla funcional propuesta

| Actor | Turno | Cambiar fecha/hora | Cambiar profesional |
| --- | --- | --- | --- |
| `PROFESSIONAL` | Propio | Sí, sujeto a HU-16/HU-09 | No |
| `PROFESSIONAL` | Ajeno | No | No |
| `RECEPTIONIST` | Cualquiera | Sí | Sí, si está habilitado |
| `MANAGER` | Cualquiera | Sí | Sí, si está habilitado |
| Otros roles o sin sesión | Cualquiera | No | No |

Decisiones concretas:

1. El profesional se identifica por la relación `Professional.userId`, sin confundir `actor.id` con `Professional.id`.
2. Para un profesional, el destino es siempre el profesional actual del turno leído en la transacción.
3. Omitir `newProfessionalId` o enviar el ID actual es válido; enviar otro ID válido produce `FORBIDDEN`, aunque el destino no exista o esté inactivo. La autorización se evalúa antes de consultar su disponibilidad.
4. No se descarta silenciosamente un destino prohibido en la mutación: se rechaza sin escribir el turno ni crear un evento.
5. En la página, un `professionalId` manipulado se ignora para `PROFESSIONAL`; la pantalla y sus consultas permanecen en la agenda propia.
6. `requestedBy` describe quién pidió el cambio y nunca concede permisos. Indicar «el centro» o «el paciente» no permite transferir el turno.
7. Se mantienen paciente y servicio fijos, motivo, confirmación, disponibilidad, estados, horizonte de fechas y trazabilidad existentes.

## 5. Secuencia de implementación

### Paso 1 — Preparar la rama y revisar convenciones

1. Volver a verificar el estado y traer `origin/master` al iniciar el desarrollo, porque puede haber cambios posteriores al plan.
2. Crear una rama propia desde la principal actualizada, por ejemplo `fix/hu-16-restringir-profesional`, siguiendo `CONTRIBUTING.md`.
3. Consultar `AGENTS.md`, `docs/DESIGN.md`, el ADR 0001 y las guías locales pertinentes de `node_modules/next/dist/docs/` sobre páginas, Server Components y Server Actions antes de escribir código.
4. Aplicar la skill local `shadcn` al modificar la interfaz existente. Reutilizar sus componentes; no hace falta instalar nuevos primitivos.

### Paso 2 — Ajustar HU y ficha antes del código

En `docs/hu/HU-16-reprogramar-turno.md`:

- Aclarar en datos opcionales que otro profesional solo lo eligen mesa de entradas y gerente.
- Precisar permisos y criterios 1 y 3 con la matriz anterior.
- Agregar criterios sobre URL manipulada, solicitud directa y ausencia de escrituras al rechazar.
- Incluir `FORBIDDEN` entre los errores de la operación por destino no autorizado.

En `docs/acciones.md`, ficha `rescheduleAppointment`:

- Agregar la condición de conservación de `professionalId` para `PROFESSIONAL`.
- Ampliar la descripción de `FORBIDDEN` al intento de transferir un turno propio.
- Mantener `newProfessionalId?`: sigue siendo necesario para mesa de entradas y gerente.

No se necesitan nuevos términos, modelos ni enums. El glosario ya define la reprogramación y el profesional. No se requieren migración ni cambios del diagrama de datos.

### Paso 3 — Cerrar la autorización en la DAL

Dentro de la transacción de `rescheduleAppointment`:

1. Conservar la lectura actual del turno y el rechazo de turno inexistente o ajeno.
2. Calcular `targetProfessionalId` con el contrato existente.
3. Antes de `loadAvailability`, comprobar que, si el actor es `PROFESSIONAL`, el destino coincide con `appointment.professionalId`.
4. Ante diferencia, lanzar `DomainError("FORBIDDEN", "Solo podés reprogramar turnos dentro de tu propia agenda.")`.
5. Conservar las validaciones de estado y tiempo. Para un turno propio futuro con destino prohibido, el rechazo debe producirse antes de evaluar la disponibilidad del destino.
6. Mantener la actualización y creación del evento dentro de la misma transacción y los reintentos actuales. La comprobación debe repetirse en cada intento con los datos recién leídos.

No trasladar esta regla a Zod: depende del actor y del turno persistido. No duplicarla únicamente en la acción. La acción existente debe propagar el error mediante `ActionResult` y conservar sus revalidaciones.

### Paso 4 — Fijar el destino en la página

1. Derivar del actor autenticado una capacidad explícita, por ejemplo `canChangeProfessional`, verdadera solo para `RECEPTIONIST` y `MANAGER`.
2. Para `PROFESSIONAL`, usar exclusivamente `appointment.professional.id` como selección, independientemente de `query.professionalId`.
3. Evitar consultar o serializar la lista completa de otros profesionales en esa rama; pasar únicamente el profesional actual como opción de presentación.
4. Para los otros dos roles, conservar los filtros actuales de profesional activo, servicio activo y franjas compatibles, y la selección válida por URL.
5. Ejecutar `listAvailableDates` y `listAvailableSlots` con el ID efectivo calculado por el servidor, manteniendo `excludeAppointmentId`.
6. Adaptar la introducción: para el profesional, «Elegí un nuevo día y horario dentro de tu agenda»; para los otros roles, conservar la posibilidad de cambiar profesional.
7. Pasar la capacidad al formulario como dato derivado del servidor. No aceptarla de la URL ni del envío del cliente como autorización.

La consulta directa de opciones ya existe en la página. Para este arreglo puede conservarse en la rama administrativa sin ampliar la deuda de arquitectura. Si se decide extraerla, usar una lectura en la DAL con actor al final, autorización propia y ficha en `docs/acciones.md`; evitar convertir esa refactorización en requisito para cerrar el defecto.

### Paso 5 — Ajustar formulario y confirmación

1. Agregar la propiedad tipada `canChangeProfessional` al componente.
2. Cuando sea falsa, mostrar el nombre del profesional como texto fijo y una explicación breve: «Solo podés reprogramar dentro de tu propia agenda».
3. No mostrar un selector deshabilitado ni el texto «único profesional habilitado»: puede haber otros profesionales, pero el usuario no puede elegirlos.
4. Cuando sea verdadera, conservar el selector y el comportamiento existente para una sola opción.
5. Derivar la selección efectiva del profesional actual cuando no se permita cambiarlo. Usar esa selección para confirmación, envío y enlaces.
6. No incluir `newProfessionalId` en el envío del profesional. Conservarlo para los roles que sí pueden cambiar el destino.
7. Evitar propagar `professionalId` en enlaces de fechas/paginación del profesional y proteger el manejador de cambio con la capacidad.
8. Mantener reinicio de horario seleccionado al cambiar fecha o profesional, errores existentes, estado pendiente y retorno al detalle.
9. Mantener el diálogo con los horarios anterior y nuevo y el mismo profesional. Ajustar mensajes que sugieran cambiar profesional cuando esa opción no esté disponible.

La capacidad del cliente mejora la experiencia; la comprobación de la DAL sigue siendo obligatoria aunque se manipulen las propiedades o la solicitud.

### Paso 6 — Mantener permisos de ruta y contratos

- Conservar los tres roles de `requirePageRole` y de `defineAction`: el profesional sigue pudiendo entrar y reprogramar.
- Verificar que la regla de `src/lib/route-access.ts` continúe alineada. No es necesario agregar rutas ni enlaces en navegación.
- Conservar el esquema `rescheduleAppointmentSchema` con `newProfessionalId` opcional y entero positivo; no endurecerlo globalmente contra los roles administrativos.
- No modificar el cálculo compartido de disponibilidad de HU-09: la restricción de destino corresponde a la reprogramación. La página debe invocarlo con el destino autorizado y la mutación debe validarlo por sí misma.

## 6. Pruebas automatizadas

Ampliar el bloque existente de HU-16 de `scripts/verify-appointments.ts`, ejecutado por `npm run test:appointments:db`. Reutilizar sus fixtures de dos profesionales, servicio compartido y actores; crear horarios libres distintos para evitar falsos rechazos por solapamiento.

| Caso | Resultado y comprobaciones |
| --- | --- |
| Profesional reprograma turno propio sin destino explícito | Éxito; conserva profesional y crea un evento `RESCHEDULED` |
| Profesional envía explícitamente el profesional actual | Éxito si cambia fecha/hora |
| Profesional envía otro profesional habilitado y libre | `FORBIDDEN`; turno y cantidad de eventos sin cambios |
| Profesional envía otro ID positivo inexistente | `FORBIDDEN`; no consulta el destino como alternativa autorizada ni escribe |
| Profesional intenta reprogramar turno ajeno | `FORBIDDEN`, con destino omitido y con destino propio |
| Profesional intenta transferir indicando otro solicitante | `FORBIDDEN`; `requestedBy` no modifica permisos |
| Mesa de entradas cambia a otro profesional habilitado | Éxito; evento con IDs anterior/nuevo correctos |
| Gerente cambia a otro profesional habilitado | Éxito; evento con IDs anterior/nuevo correctos |
| Profesional conserva horario y profesional | Sigue rechazándose como `VALIDATION` |

Para los rechazos, tomar antes y después una instantánea de `professionalId`, `startsAt`, `endsAt`, estado y eventos, y verificar igualdad. Para los éxitos, comprobar conservación de ID, paciente, servicio, autor y fecha de creación, así como actor y profesionales del evento.

Conservar y ejecutar las pruebas existentes de estados, motivo, disponibilidad, exclusión del propio turno, solapamientos y concurrencia. Las fixtures deben limpiarse también ante fallos, siguiendo el patrón actual del script.

No agregar una prueba unitaria que solo reproduzca el condicional de autorización: la prueba importante invoca la DAL real con PostgreSQL. `npm run check` no incluye la suite de base de datos; deben ejecutarse ambas verificaciones por separado.

## 7. Verificación funcional en navegador

Preparación: disponer de un turno propio Programado y futuro, dos profesionales activos que presten el mismo servicio y tengan horarios libres, y usuarios de los tres roles. Usar datos de prueba locales; no hace falta reiniciar la base ni volver a sembrarla si ya existen.

1. Entrar como profesional y abrir el turno desde su agenda. Al reprogramar, comprobar nombre fijo, ausencia de selector y texto de agenda propia.
2. Elegir fecha/hora, completar motivo y solicitante, confirmar y comprobar el resultado en detalle y agenda. El historial muestra al mismo profesional antes y después.
3. Abrir `/appointments/<id>/reschedule?professionalId=<otro-id>` y navegar por fechas y páginas. La selección, las consultas y la confirmación deben seguir en el profesional actual.
4. Verificar que la restricción no desaparece al recargar o volver atrás y que una falta de disponibilidad no ofrece transferir el turno como alternativa.
5. Intentar abrir un turno ajeno y comprobar que se mantiene la protección existente.
6. Como mesa de entradas y como gerente, transferir un turno a otro profesional habilitado y comprobar disponibilidad, confirmación, detalle e historial.
7. Comprobar que la bitácora del paciente conserva la presentación de la reprogramación y sus restricciones de acceso incorporadas por HU-26.
8. Revisar accesibilidad básica: nombre del profesional legible, etiquetas, navegación por teclado y foco del diálogo, sin introducir colores fuera de los tokens existentes.

La solicitud manipulada se verifica de forma reproducible en la suite de la DAL; si se prueba además la Server Action en navegador, debe devolver `FORBIDDEN` y no generar escrituras.

## 8. Comandos y condiciones de cierre del desarrollo

1. Verificar dependencias y entorno local sin exponer `.env`. Usar `npm ci` si corresponde y `npm run db:generate` si falta el cliente generado.
2. Disponer de Docker/PostgreSQL local con las migraciones vigentes para la suite de integración: `npm run db:up` y `npm run db:migrate` cuando sea necesario. Este arreglo no crea migraciones.
3. Ejecutar `npm run test:appointments:db` y dejarlo en verde.
4. Ejecutar `npm run check` y dejarlo en verde. Si falla formato, corregirlo y repetir el check completo; corregir las causas de lint o tipos sin silenciamientos.
5. Completar las pruebas funcionales anteriores y revisar el diferencial para confirmar que no se cambiaron permisos administrativos ni reglas de disponibilidad.
6. Informar comandos ejecutados y resultados reales. Una suite no ejecutada por falta de entorno debe declararse pendiente y no darse por aprobada.
7. Solo después, preparar un commit en español y, si el usuario lo solicita, push y PR hacia `master`. El agente no aprueba ni mergea el PR.

## 9. Archivos previstos

| Archivo | Cambio |
| --- | --- |
| `docs/hu/HU-16-reprogramar-turno.md` | Regla por rol y criterios verificables |
| `docs/acciones.md` | Precondición y error por destino prohibido |
| `src/lib/dal/appointments.ts` | Autorización del profesional de destino en la transacción |
| `src/app/(app)/appointments/[id]/reschedule/page.tsx` | Selección efectiva por rol, opciones y texto |
| `src/app/(app)/appointments/[id]/reschedule/reschedule-form.tsx` | Profesional fijo, envío, enlaces y confirmación |
| `scripts/verify-appointments.ts` | Casos de autorización y ausencia de efectos |

Los archivos de acciones, validación y acceso por ruta se revisan para comprobar compatibilidad; no requieren cambios por defecto. No se prevén dependencias nuevas, cambios de esquema ni migraciones.

## 10. Información disponible y pendientes

**Sí: hay información suficiente para desarrollar esta mejora.** El pedido define la regla que faltaba y el repositorio contiene historia, contrato, flujo de interfaz, autorización, esquema y pruebas de integración reutilizables. No hace falta una decisión adicional del cliente para impedir la transferencia por parte del profesional.

La propuesta de aceptar un ID explícito igual al actual y de ignorar el destino manipulado en la página son decisiones de implementación documentadas en este plan; el intento de transferencia en la mutación siempre se rechaza.

Antes de ejecutar el desarrollo solo resta verificar disponibilidad operativa de dependencias, cliente Prisma y PostgreSQL local. Para elaborar este plan no se inspeccionaron secretos ni se levantó la aplicación o la base; por lo tanto no se afirma que ese entorno esté listo ni que la funcionalidad haya sido probada.

Hallazgo lateral: el catálogo de errores documenta `APPOINTMENT_HAS_PAYMENT` para la reprogramación, pero en la función revisada no se observa una llamada a `assertNoActivePayment`. Debe registrarse y revisarse por separado; este plan no propone corregir esa discrepancia como parte de la restricción de profesional ni tomarla como bloqueo.

### Criterio final de aceptación

La mejora queda terminada cuando el profesional puede mover un turno propio dentro de su agenda, no puede transferirlo por interfaz, URL ni solicitud directa, los otros dos roles conservan esa capacidad, los rechazos no dejan eventos ni cambios parciales, la documentación coincide con el comportamiento y pasan `npm run check` y `npm run test:appointments:db`.

## 11. Ejecución y verificaciones realizadas

Implementado en la rama `fix/hu-16-restringir-profesional`, sobre la misma base `11ed84d`. Antes de empezar se volvió a ejecutar `git fetch origin --prune`; no había nuevos cambios en `origin/master`.

### Resultado implementado

- La DAL rechaza con `FORBIDDEN` el destino distinto del actual para `PROFESSIONAL`, dentro de la transacción y antes de consultar su disponibilidad.
- La página ignora `professionalId` para ese rol y no consulta ni envía la lista de otras agendas.
- El formulario muestra el profesional fijo, omite el destino en el envío y no lo propaga en los enlaces. La confirmación y la validación de horario usan la selección efectiva.
- Mesa de entradas y gerente conservan sus permisos, el selector y el contrato existente.
- Se actualizaron HU-16 y la ficha de la operación. No se modificaron esquema, migraciones, roles de ruta ni dependencias.

### Verificación automatizada

| Comando | Resultado |
| --- | --- |
| `npm run db:up` | PostgreSQL local saludable; se inició Docker Desktop porque estaba apagado |
| `prisma migrate status` (ejecutable local) | Las cinco migraciones están aplicadas; esquema actualizado |
| `npm run check` | Correcto: formato, lint, tipos, validación de Prisma y 127 pruebas unitarias sin fallos |
| `npm run test:appointments:db` | Correcto: 14 grupos, incluidos HU-16, permisos, trazabilidad y concurrencia |
| `npm run test:patient-history:db` | Correcto: 11 grupos de HU-26, incluidos permisos y eventos del historial |
| `git diff --check` | Sin errores de espacios ni marcadores de conflicto |

La suite ampliada verifica destinos ajenos habilitados e inexistentes con los tres solicitantes, igualdad completa del turno y sus eventos después de rechazos, intento de tomar un turno ajeno, reprogramaciones propias con destino omitido o explícito, rechazo de horario idéntico y transferencias administrativas autorizadas.

### Verificación funcional

Se inició la aplicación local y se comprobó en navegador con usuarios de prueba:

- Profesional: nombre fijo, selector ausente y texto de agenda propia.
- URL con destino de otro profesional habilitado para el servicio: se conserva el profesional original y sus fechas y horarios.
- Paginación desde esa URL: elimina el destino manipulado y conserva la agenda propia.
- Diálogo de confirmación: muestra al mismo profesional antes y después, incluso indicando al centro como solicitante.
- Mesa de entradas: selector disponible, permite seleccionar otro profesional y obtiene las fechas de su agenda.

Las comprobaciones del navegador llegaron hasta la confirmación sin modificar los turnos de demostración. Las escrituras exitosas, los rechazos sin efectos y los permisos de gerente se verificaron con las fixtures temporales de PostgreSQL, que la suite limpia al terminar.

Al finalizar la implementación, los cambios quedaron locales para revisión previa a su publicación. No se encontraron bloqueos en las verificaciones ejecutadas para esta corrección.
