# Verificación de HU-09 — Asignar un turno

## Dónde entrar y con qué rol

- **Mesa de entradas (`RECEPTIONIST`) o gerente (`MANAGER`):** menú **Nuevo turno**, ruta `/appointments/new`. Ambos pueden confirmar turnos.
- **Profesional (`PROFESSIONAL`):** menú **Mi agenda**, ruta `/agenda`. Consulta exclusivamente los turnos de la ficha vinculada a su usuario. No tiene acceso al alta de turnos.
- **Calendario** (`/calendar`): gerente y mesa de entradas consultan los turnos del centro por fecha.
- **Mis horarios** (`/my-schedule`) muestra las franjas semanales; no es la agenda de turnos.

Los usuarios de demo del seed están en `CONTRIBUTING.md`; no se necesita correr el seed para usar datos ya cargados.

## Recorrido manual

1. Como gerente, comprobar que el servicio y el profesional estén activos, que el profesional preste ese servicio y tenga franjas: **Profesionales → Ver ficha → Editar horarios**. Elegir una fecha que coincida con el día de la franja y no sea feriado ni ausencia.
2. Entrar como gerente o mesa de entradas a **Nuevo turno**.
3. Buscar paciente por nombre, apellido o documento y seleccionarlo. Si no existe, elegir **Registrar un paciente nuevo**; luego usar **Asignar turno** en la confirmación del alta.
4. Elegir el servicio y pulsar **Seleccionar servicio**. Se indica su duración.
5. Elegir profesional y fecha, y pulsar **Ver horarios disponibles**.
6. Seleccionar un horario, revisar el resumen y, si hace falta, agregar una observación de hasta 500 caracteres. Pulsar **Confirmar turno** una vez.
7. Verificar el mensaje de éxito, estado Programado, paciente, servicio, profesional, día, inicio, fin, duración, autor y fecha de creación.
8. Pulsar **Volver al calendario**: debe verse el turno en su fecha. **Dar otro turno** inicia otra asignación.
9. Ingresar como el profesional vinculado a la ficha, abrir **Mi agenda** y elegir la misma fecha: debe aparecer el turno. No debe haber botón para asignar ni acceso a turnos ajenos.
10. Para probar conflicto, abrir el mismo horario en dos pestañas antes de confirmar. Confirmar en una y luego en la otra: la segunda avisa que el horario se ocupó, lo elimina de la grilla y conserva los datos de selección.

## Criterios y evidencia

| # | Criterio de HU-09 | Verificación |
|---|---|---|
| 1 | Gerente y mesa asignan; profesional consulta solo lo propio | DAL y recorrido de navegador con los tres roles |
| 2 | Buscar/elegir paciente o registrarlo y continuar | Búsqueda en DAL y navegador; enlace de HU-07 a `/appointments/new?patientId=...` |
| 3 | Servicio fija duración; profesionales activos, asociados y con franjas habilitadas | Pruebas de duración variable, filtros y entidades inactivas |
| 4 | Bloque completo en franja habilitada; sin feriados ni ausencias | Pruebas unitarias y PostgreSQL con ausencia parcial, completa y feriado |
| 5 | Sin pasado y hasta dos meses, en hora de Argentina | Pruebas de validación y límites de calendario |
| 6 | Sin solapamiento del profesional ni del paciente, incluso simultáneo | Pruebas concurrentes de DAL y de ambas restricciones PostgreSQL |
| 7 | Conflicto avisa y refresca grilla conservando selección | Prueba de navegador con dos pestañas |
| 8 | Programado, fin calculado, observación opcional y autoría | Pruebas de DAL y resúmenes del navegador |
| 9 | Visible en calendario y agenda propia | Pruebas de consulta y recorrido de navegador |
| 10 | Resumen legible y opciones calendario/otro turno | Recorrido de navegador |
| 11 | Aviso por email | **PENDIENTE**, postergado por pedido expreso del 23/09/2026 |

## Comandos reproducibles

- `npm run db:generate`: genera el cliente del schema existente.
- `npm run check`: formato, lint, tipos, validación Prisma y las pruebas unitarias de disponibilidad (`npm test`).
- `npm run test:appointments:db`: pruebas sobre PostgreSQL local migrado. Crea fixtures identificadas con UUID y borra sus propios registros en `finally`. Rechaza bases remotas y `NODE_ENV=production`. Requiere Node 22.15+ o 24 por el cargador de pruebas; solo neutraliza el marcador `server-only` fuera de Next, sin simular la DAL ni Prisma.

No se considera enviado un correo por haber guardado el turno. La confirmación muestra explícitamente **Email al paciente: PENDIENTE**. La aceptación del cliente y el PR aprobado siguen siendo necesarios para el cierre formal de la historia.
