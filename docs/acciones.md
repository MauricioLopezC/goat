# Acciones: convención y catálogo

Contrato de las Server Actions de Goat y catálogo de operaciones. La decisión de fondo está en [ADR 0001](adr/0001-server-actions-y-capa-de-acceso-a-datos.md).

Los nombres de código (modelos, roles, estados, funciones) siguen [`glossary.md`](glossary.md). La documentación va en español y el código en inglés.

## Estructura

```
src/
  app/<route>/actions.ts     # "use server": adaptadores finos, una acción por operación
  lib/
    dal/                     # import "server-only": autorización, reglas de negocio, Prisma
      auth.ts                #   getSession(), requireRole(), assertRole()
      appointments.ts        #   createAppointment(), cancelAppointment(), ...
    validation/              # schemas Zod, fuente única de la entrada
      zod.ts                 #   `z` con los mensajes en español (único import de "zod")
    actions/                 # ActionResult, ErrorCode, DomainError, defineAction
```

- Las rutas y los archivos van en inglés (`appointments`, no `turnos`).
- Solo la DAL importa `prisma` y lee `process.env`. Las páginas y las acciones no acceden a la base directamente.
- La regla de negocio vive en la función de la DAL, no en la acción. La ficha especifica la operación y se implementa en la DAL.
- Toda función de la DAL que lee o escribe datos de negocio recibe el `actor` y verifica ella misma rol y pertenencia. Ver [Autorización en la DAL](#autorización-en-la-dal).

## Flujo obligatorio de una acción

1. **Sesión y rol:** `requireRole(...)`. La sesión se verifica dentro de cada acción aunque `proxy.ts` ya la haya chequeado.
2. **Validar entrada** con el schema Zod de `src/lib/validation/`. Zod valida la forma. La pertenencia del recurso (por ejemplo, que el turno sea de la agenda del profesional que lo invoca) se verifica en la DAL.
3. **Llamar a la DAL pasándole el `actor`**. La DAL vuelve a verificar el rol, verifica la pertenencia, aplica la regla de negocio y escribe con Prisma.
4. **Revalidar** con `revalidatePath` o `revalidateTag` antes de cualquier `redirect` (el `redirect` corta la ejecución).
5. **Devolver `ActionResult<T>`.**

`defineAction` aplica este flujo, así que cada acción declara sus roles y su schema en la firma y no se puede omitir ninguno:

```ts
export const cancelAppointment = defineAction({
  roles: ["RECEPTIONIST", "MANAGER"],
  input: cancelAppointmentSchema,
  handler: (input, actor) => dal.cancelAppointment(input, actor),
})
```

## Autorización en la DAL

El rol se chequea dos veces, a propósito. La acción (`defineAction({ roles })`) o la página (`requirePageRole`) cortan temprano. La función de la DAL lo vuelve a verificar y además chequea lo que depende de los datos, porque es la única barrera que vale sin importar desde dónde se la llame. La decisión está en el [ADR 0001](adr/0001-server-actions-y-capa-de-acceso-a-datos.md#dónde-se-autoriza).

Ejemplo ilustrativo (la ficha real de `cancelAppointment` se define con su historia):

```ts
// src/lib/dal/appointments.ts
export async function cancelAppointment(input: CancelAppointmentInput, actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.PROFESSIONAL, Role.MANAGER)

  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: { id: true, status: true, professional: { select: { userId: true } } },
  })
  if (!appointment) throw new DomainError("NOT_FOUND", "El turno no existe.")

  // Pertenencia: un profesional solo cancela turnos de su propia agenda.
  if (actor.role === Role.PROFESSIONAL && appointment.professional.userId !== actor.id) {
    throw new DomainError("FORBIDDEN", "No tenés permiso para realizar esta operación.")
  }

  // ...regla de negocio y escritura
}

// Server Component: la lectura también recibe el actor.
const actor = await requirePageRole("MANAGER")
const users = await listUsers(actor)
```

- **El `actor` va como último parámetro**, también en las lecturas. La función no lee la sesión ni confía en que quien la llama haya chequeado.
- **`assertRole` es la primera línea** de la función, antes de tocar la base.
- **Los roles de la ficha valen para las dos barreras.** Si cambian, cambian en la acción y en la DAL en el mismo commit.
- Sin `actor` quedan solo las funciones que crean o leen la sesión: `getSession`, `requireRole`, `requirePageRole`, `signIn` y `signOut`.

## `ActionResult`

Los errores esperados (validación, reglas de negocio, permisos) se devuelven como valor. Los inesperados se lanzan y los maneja el `error.tsx` de la ruta. Es el formato que consume `useActionState`.

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError }

type ActionError = {
  code: ErrorCode
  message: string                          // en español, apto para mostrar
  fieldErrors?: Record<string, string[]>   // solo para VALIDATION
  meta?: Record<string, unknown>           // metadatos del error (ej. recurso duplicado)
}
```

- La DAL lanza `DomainError` con un `ErrorCode`. `defineAction` lo convierte en `{ ok: false }`. Cualquier otra excepción se relanza.
- La interfaz decide según `error.code`, nunca según el texto del mensaje.
- `data` contiene solo lo que la interfaz necesita mostrar, no registros crudos de Prisma.

### `ErrorCode`

Lista inicial. Se agrega un código cuando una regla de negocio nueva lo necesita, y se documenta acá en el mismo cambio.

| Código | Cuándo |
|---|---|
| `VALIDATION` | La entrada no cumple el schema. Incluye `fieldErrors`. |
| `FORBIDDEN` | Hay sesión, pero el rol no permite la operación o el recurso no le corresponde. |
| `NOT_FOUND` | El recurso referenciado no existe. |
| `APPOINTMENT_OVERLAP` | El turno se superpone con otro del mismo profesional. |
| `PATIENT_APPOINTMENT_OVERLAP` | El paciente ya tiene otro turno en ese horario, con cualquier profesional. |
| `OUTSIDE_AVAILABILITY_WINDOW` | El turno queda fuera de la `AvailabilityWindow` del profesional, o cae en una `AvailabilityException` suya o en un `Holiday`. |
| `INVALID_STATUS_TRANSITION` | El cambio de `AppointmentStatus` no está permitido (ver `glossary.md`). |
| `REASON_REQUIRED` | Falta el motivo en una operación trazable (por ejemplo, cancelar). |
| `DUPLICATE` | El recurso que se intenta crear ya existe (por ejemplo, matrícula o documento duplicado). Incluye `fieldErrors` con los campos afectados. |
| `DUPLICATE_PATIENT` | Ya existe un paciente con ese tipo y número de documento. Incluye metadatos en `meta` (id, nombre, etc.) para que la UI pueda ofrecer abrir el paciente existente. |
| `INVALID_CREDENTIALS` | El ingreso falló. Cubre email inexistente, contraseña incorrecta y usuario inactivo: los tres devuelven lo mismo, a propósito (HU-01). |
| `EMAIL_TAKEN` | Ya existe un usuario con ese email. |
| `UNMET_DEPENDENCY` | La operación no puede completarse porque existen registros dependientes (por ejemplo, dar de baja un servicio con turnos futuros programados). |

Sin sesión no hay `ErrorCode`: `requireRole` redirige al login.

## Mensajes de validación

Los schemas importan `z` de `@/lib/validation/zod`, nunca de `"zod"` (una regla de ESLint lo impide). Ese módulo configura los mensajes por defecto en español y en un tono neutro apto para mostrar (`Este campo es obligatorio`, `Debe tener al menos 3 caracteres`, `Correo electrónico inválido`).

- Los mensajes genéricos cubren campo vacío, largo, rango, opción inválida y formatos comunes. Un `regex` devuelve solo `Formato inválido`.
- Cuando el campo necesita un mensaje propio, se pasa en el schema: `z.string().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 dígitos")`.
- `fieldErrors` de `ActionError` sale de `z.flattenError(error).fieldErrors`, ya en español.

## Reglas que toda ficha debe reflejar

Vienen de `AGENTS.md` y no se negocian:

- **Trazabilidad:** toda operación que crea, modifica o cancela un turno registra quién, cuándo y con qué motivo. El alta guarda su autor en `Appointment.createdById`; todo cambio posterior (cancelar, completar, vencer, modificar) agrega un `AppointmentEvent` con el usuario, el instante, el motivo y quién lo solicitó. La operación que cambia el estado de un turno actualiza el `Appointment` y crea su `AppointmentEvent` en la misma transacción.
- **Valores separados:** el valor de la `Service`, la `Coverage` y lo que paga el paciente (`Copay`, `Payment`) son datos distintos. Ninguna operación los mezcla en un solo campo.
- **Rol:** toda operación declara los `Role` permitidos.

## Plantilla de ficha

Una ficha por operación. El nombre es el de la función de la DAL y de la acción (`verbNoun` en inglés).

```markdown
### `operationName`

**Historia de usuario:** enlace a la HU y a sus criterios de aceptación.
**Roles:** `RECEPTIONIST`, `PROFESSIONAL`
**Entrada:** campos y tipos (referencias por ID, no objetos completos).
**Precondiciones:** qué debe ser cierto antes de ejecutar (incluye pertenencia del recurso).
**Efectos:** qué cambia en la base y qué se registra para trazabilidad.
**Errores:** `ErrorCode` posibles, con la condición que los dispara.
**Revalida:** rutas o tags.
**Devuelve:** forma de `data` cuando `ok: true`.
```

### Ejemplo ilustrativo

> No vinculante: muestra cómo se completa la plantilla. La especificación real se define con la historia de usuario correspondiente.

#### `createAppointment`

**Historia de usuario:** [HU-09 — Asignar un turno](hu/HU-09-asignar-turno.md)
**Roles:** `RECEPTIONIST`, `PROFESSIONAL`
**Entrada:** `patientId`, `professionalId`, `serviceId`, `startsAt`. La duración la fija la `Service`.
**Precondiciones:** el `startsAt` más la duración de la `Service` cae dentro de una `AvailabilityWindow` del profesional. No hay otro turno activo del profesional en ese intervalo. Si el rol es `PROFESSIONAL`, `professionalId` es el suyo.
**Efectos:** crea un `Appointment` en estado `SCHEDULED`. Registra quién lo creó y cuándo.
**Errores:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `OUTSIDE_AVAILABILITY_WINDOW`, `APPOINTMENT_OVERLAP`.
**Revalida:** la agenda del profesional.
**Devuelve:** `{ id, startsAt, endsAt, status }`.

## Catálogo

Una ficha por operación implementada o acordada. Se agregan a medida que se trabaja cada historia de usuario ([`docs/hu/`](hu/README.md)) y se mantienen junto con el código: si una regla cambia, cambia la ficha en el mismo commit.

### `createProfessional`

**Historia de usuario:** [HU-02 — Registrar un profesional](hu/HU-02-registrar-profesional.md)
**Roles:** `MANAGER`
**Entrada:** `lastName`, `firstName`, `documentType` (`DocumentType`), `documentNumber`, `licenseNumber`, `titleIds` (`Int[]`, al menos uno), `serviceIds` (`Int[]`, al menos uno), `phone?`, `email?`, `photoUrl?`, `notes?`.
**Precondiciones:** el actor es `MANAGER` (lo verifican la acción y la DAL). No existe otro `Professional` activo o inactivo con el mismo par (`documentType`, `documentNumber`). No existe otro `Professional` con la misma `licenseNumber`. Todos los `titleIds` y `serviceIds` corresponden a registros activos de `ProfessionalTitle` y `Service`.
**Efectos:** crea un `Professional` con `active: true`, sin franjas horarias. Asocia los `ProfessionalTitle` y `Service` indicados. Registra `createdById` con el id del usuario de la sesión. El profesional no aparece como opción al dar turnos hasta que se le carguen franjas ([HU-05](hu/HU-05-franjas-de-atencion.md)).
**Errores:** `VALIDATION` (campo obligatorio vacío, matrícula no numérica o fuera de rango 1–8 dígitos, email con formato inválido, arrays vacíos), `FORBIDDEN` (el rol no es `MANAGER`), `NOT_FOUND` (algún `titleId` o `serviceId` no existe o no está activo), `DUPLICATE` (documento o matrícula ya registrados; incluye `fieldErrors`).
**Revalida:** `/professionals` (listado de profesionales).
**Devuelve:** `{ id, firstName, lastName }`.

### `signIn`

**Historia de usuario:** [HU-01 — Ingresar al sistema con mi rol](hu/HU-01-ingresar-al-sistema.md)
**Roles:** ninguno. Es la operación que *crea* la sesión, así que es la única —junto con `signOut`— que no pasa por `requireRole`. Ver la nota al final de la ficha.
**Entrada:** `email`, `password`.
**Precondiciones:** existe un `User` con ese email, está `active` y la contraseña verifica contra su `passwordHash` (argon2id, [ADR 0002](adr/0002-autenticacion-y-sesion.md)).
**Efectos:** sella la cookie de sesión con `{ userId, role }`. No escribe en la base.
**Errores:** `VALIDATION` (email mal formado o campo vacío), `INVALID_CREDENTIALS`.
**Revalida:** nada. Redirige.
**Devuelve:** en el camino feliz no devuelve: redirige a la pantalla inicial del rol (`RECEPTIONIST` → calendario del día del centro, `PROFESSIONAL` → su agenda del día, `MANAGER` → listado de profesionales). `ActionResult` solo viaja en el caso de error.

Dos cosas que esta ficha fija y conviene no perder al implementar:

- **Un solo error para tres causas distintas.** Email inexistente, contraseña incorrecta y usuario inactivo devuelven `INVALID_CREDENTIALS` con el mismo mensaje. Distinguir el usuario inactivo revelaría que ese email existe en el sistema, y HU-01 pide mensaje genérico.
- **El hash se verifica siempre**, incluso cuando el email no existe, contra un hash descartable. Si no, el tiempo de respuesta delata qué emails están registrados.

### `signOut`

**Historia de usuario:** [HU-01 — Ingresar al sistema con mi rol](hu/HU-01-ingresar-al-sistema.md)
**Roles:** cualquier sesión válida. No discrimina por rol.
**Entrada:** ninguna.
**Precondiciones:** ninguna. Es idempotente: sin sesión abierta también termina bien.
**Efectos:** borra la cookie de sesión. No escribe en la base.
**Errores:** ninguno.
**Revalida:** nada. Redirige.
**Devuelve:** no devuelve: redirige a `/login`.

### `createUser`

**Historia de usuario:** [HU-01 — Ingresar al sistema con mi rol](hu/HU-01-ingresar-al-sistema.md)
**Roles:** `MANAGER`. Es el único que crea usuarios y asigna roles.
**Entrada:** `firstName`, `lastName`, `email`, `password` (inicial, la fija el gerente), `role`, `phone` (opcional).
**Precondiciones:** el actor es `MANAGER` (lo verifican la acción y la DAL). No existe otro `User` con ese email.
**Efectos:** crea un `User` con `active: true` y la contraseña hasheada con argon2id. La contraseña en claro no se guarda ni se registra en ningún lado.
**Errores:** `VALIDATION`, `FORBIDDEN`, `EMAIL_TAKEN`.
**Revalida:** el listado de usuarios.
**Devuelve:** `{ id, firstName, lastName, email, role }`. Nunca el `passwordHash`.

No vincula la cuenta con un `Professional`: esa relación (`Professional.userId`) la maneja el alta de profesional, [HU-02](hu/HU-02-registrar-profesional.md).

### `listUsers`

**Historia de usuario:** [HU-01 — Ingresar al sistema con mi rol](hu/HU-01-ingresar-al-sistema.md)
**Roles:** `MANAGER`.
**Entrada:** el `actor`. No recibe parámetros de la interfaz.
**Precondiciones:** el actor es `MANAGER`.
**Efectos:** ninguno. Es una lectura.
**Errores:** `FORBIDDEN` si el actor no es `MANAGER`. En `/users` no llega a dispararse: `requirePageRole` redirige antes a la pantalla del rol. Queda como barrera por si la función se llama desde otro lado.
**Revalida:** no aplica.
**Devuelve:** `{ id, firstName, lastName, email, role, active, createdAt }[]`, ordenado por estado y apellido. Nunca el `passwordHash`.

No es una Server Action: es una lectura que el Server Component de `/users`
llama directo a la DAL (ADR 0001). Lleva ficha igual porque tiene una
restricción de rol y decide qué datos del usuario salen a la interfaz.

### `listProfessionals`

**Historia de usuario:** [HU-02 — Registrar un profesional](hu/HU-02-registrar-profesional.md) / [HU-04 — Buscar y listar profesionales](hu/HU-04-buscar-profesionales.md)
**Roles:** `MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`
**Entrada:** el `actor`. No recibe parámetros de la interfaz.
**Precondiciones:** el actor pertenece a `STAFF_ROLES` (`MANAGER`, `RECEPTIONIST` o `PROFESSIONAL`).
**Efectos:** ninguno. Es una lectura.
**Errores:** `FORBIDDEN` si el actor no pertenece al personal del centro. En `/professionals` no llega a dispararse: `requirePageRole` redirige antes. Queda como barrera por si la función se llama desde otro lado.
**Revalida:** no aplica.
**Devuelve:** `{ id, lastName, firstName, documentType, documentNumber, licenseNumber, phone, email, active, titles: { id, name }[], services: { id, name, durationMinutes }[] }[]`, ordenado por estado activo, apellido y nombre.

No es una Server Action: es una lectura que el Server Component de `/professionals` llama directo a la DAL (ADR 0001).

### `listActiveProfessionalTitles`

**Historia de usuario:** [HU-02 — Registrar un profesional](hu/HU-02-registrar-profesional.md)
**Roles:** `MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`
**Entrada:** el `actor`. No recibe parámetros de la interfaz.
**Precondiciones:** el actor pertenece a `STAFF_ROLES`.
**Efectos:** ninguno. Es una lectura del catálogo de títulos activos.
**Errores:** `FORBIDDEN` si el actor no pertenece al personal del centro.
**Revalida:** no aplica.
**Devuelve:** `{ id, name }[]`, ordenado alfabéticamente por nombre.

### `listActiveServices`

**Historia de usuario:** [HU-02 — Registrar un profesional](hu/HU-02-registrar-profesional.md) / [HU-06 — Catálogo de servicios](hu/HU-06-catalogo-de-servicios.md)
**Roles:** `MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`
**Entrada:** el `actor`. No recibe parámetros de la interfaz.
**Precondiciones:** el actor pertenece a `STAFF_ROLES`.
**Efectos:** ninguno. Es una lectura del catálogo de servicios activos.
**Errores:** `FORBIDDEN` si el actor no pertenece al personal del centro.
**Revalida:** no aplica.
### `listServices`

**Historia de usuario:** [HU-06 — Catálogo de servicios](hu/HU-06-catalogo-de-servicios.md)
**Roles:** `MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`
**Entrada:** el `actor`. No recibe parámetros de la interfaz.
**Precondiciones:** el actor pertenece a `STAFF_ROLES`.
**Efectos:** ninguno. Es una lectura de todos los servicios (activos e inactivos) del centro.
**Errores:** `FORBIDDEN` si el actor no pertenece al personal del centro.
**Revalida:** no aplica.
**Devuelve:** `{ id, name, description, durationMinutes, requiresReferral, active, specialty: { id, name } | null }[]`, ordenado por estado activo primero y nombre alfabético.

No es una Server Action: es una lectura que el Server Component de `/services` llama directo a la DAL (ADR 0001).

### `listActiveSpecialties`

**Historia de usuario:** [HU-06 — Catálogo de servicios](hu/HU-06-catalogo-de-servicios.md)
**Roles:** `MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`
**Entrada:** el `actor`. No recibe parámetros de la interfaz.
**Precondiciones:** el actor pertenece a `STAFF_ROLES`.
**Efectos:** ninguno. Es una lectura de las áreas/especialidades activas para el formulario.
**Errores:** `FORBIDDEN` si el actor no pertenece al personal del centro.
**Revalida:** no aplica.
**Devuelve:** `{ id, name }[]`, ordenado alfabéticamente por nombre.

### `createService`

**Historia de usuario:** [HU-06 — Catálogo de servicios](hu/HU-06-catalogo-de-servicios.md)
**Roles:** `MANAGER`
**Entrada:** `name`, `durationMinutes` (por defecto 30 en Inc. 1), `requiresReferral` (booleano), `description?`, `specialtyId?`.
**Precondiciones:** el actor es `MANAGER`. No existe otro `Service` con el mismo `name`. Si se envía `specialtyId`, debe corresponder a una `Specialty` activa.
**Efectos:** crea un `Service` con `active: true`.
**Errores:** `VALIDATION` (nombre vacío o duración inválida), `FORBIDDEN` (actor no es `MANAGER`), `DUPLICATE` (ya existe un servicio con ese nombre; incluye `fieldErrors`), `NOT_FOUND` (la especialidad indicada no existe o no está activa).
**Revalida:** `/services` y `/professionals`.
**Devuelve:** `{ id, name, durationMinutes, requiresReferral }`.

### `updateService`

**Historia de usuario:** [HU-06 — Catálogo de servicios](hu/HU-06-catalogo-de-servicios.md)
**Roles:** `MANAGER`
**Entrada:** `id`, `name`, `durationMinutes`, `requiresReferral`, `description?`, `specialtyId?`.
**Precondiciones:** el actor es `MANAGER`. El servicio existe. No existe otro servicio con ese `name` (distinto id). Si se envía `specialtyId`, debe existir.
**Efectos:** actualiza los datos del `Service`.
**Errores:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE`.
**Revalida:** `/services` y `/professionals`.
**Devuelve:** `{ id, name, durationMinutes, requiresReferral }`.

### `deactivateService`

**Historia de usuario:** [HU-06 — Catálogo de servicios](hu/HU-06-catalogo-de-servicios.md)
**Roles:** `MANAGER`
**Entrada:** `id`.
**Precondiciones:** el actor es `MANAGER`. El servicio existe y está activo. No existen turnos futuros (`Appointment`) en estado `SCHEDULED` con fecha `startsAt >= now()` para este servicio.
**Efectos:** realiza la baja lógica del servicio (`active: false`). No elimina el registro para preservar el historial.
**Errores:** `FORBIDDEN` (actor no es `MANAGER`), `NOT_FOUND` (servicio inexistente), `UNMET_DEPENDENCY` (existen turnos futuros programados).
**Revalida:** `/services` y `/professionals`.
**Devuelve:** `{ id, name, active: false }`.

### `activateService`

**Historia de usuario:** [HU-06 — Catálogo de servicios](hu/HU-06-catalogo-de-servicios.md)
**Roles:** `MANAGER`
**Entrada:** `id`.
**Precondiciones:** el actor es `MANAGER`. El servicio existe.
**Efectos:** reactiva un servicio previamente dado de baja (`active: true`), volviendo a habilitarlo para nuevos turnos y asignación a profesionales.
**Errores:** `FORBIDDEN` (actor no es `MANAGER`), `NOT_FOUND` (servicio inexistente).
**Revalida:** `/services` y `/professionals`.
**Devuelve:** `{ id, name, active: true }`.

### `createPatient`

**Historia de usuario:** [HU-07 — Registrar un paciente nuevo](hu/HU-07-registrar-paciente.md)
**Roles:** `RECEPTIONIST`, `MANAGER`
**Entrada:** `lastName`, `firstName`, `gender`, `documentType`, `documentNumber`, `birthDate`, `phone`, `email`, `coverageType`, `insurancePlanId` (si `coverageType` es `HEALTH_INSURANCE`), `memberNumber` (si `coverageType` es `HEALTH_INSURANCE`), `guardianName` (opcional en general; **obligatorio si la edad derivada de `birthDate` es menor de 16 años**), `guardianPhone` (opcional en general; **obligatorio si la edad derivada de `birthDate` es menor de 16 años**).
**Precondiciones:** no existe otro paciente con la misma combinación de `documentType` y `documentNumber`. Si `coverageType` es `HEALTH_INSURANCE`, el `insurancePlanId` existe y está activo. Si la edad calculada a partir de `birthDate` es menor de 16 años, `guardianName` y `guardianPhone` deben estar presentes y no vacíos; esta regla se valida en el schema Zod (`createPatientSchema`) y no se puede omitir invocando la acción directamente.
**Efectos:** crea un `Patient` con `active: true` y `createdById`. Si `coverageType` es `HEALTH_INSURANCE`, crea además su `Coverage` asociada.
**Errores:** `VALIDATION` (campo obligatorio vacío, formato inválido, tutor ausente para menor de 16 años), `FORBIDDEN`, `DUPLICATE_PATIENT`.
**Revalida:** `/patients`.
**Devuelve:** `{ id, firstName, lastName, documentType, documentNumber }`.

### `listHealthInsurers`

**Historia de usuario:** [HU-07 — Registrar un paciente nuevo](hu/HU-07-registrar-paciente.md)
**Roles:** `RECEPTIONIST`, `MANAGER`
**Entrada:** ninguna (recibe el `actor` para verificación de permisos).
**Precondiciones:** ninguna.
**Efectos:** ninguno. Es una lectura para poblar los selectores de cobertura y plan.
**Errores:** `FORBIDDEN` si el actor no pertenece a los roles habilitados.
**Revalida:** no aplica.
**Devuelve:** `{ id, name, plans: { id, name }[] }[]` de obras sociales y planes activos, ordenados alfabéticamente.

### `searchPatients`

**Historia de usuario:** [HU-08 — Buscar y modificar un paciente](hu/HU-08-buscar-modificar-paciente.md)
**Roles:** `RECEPTIONIST`, `MANAGER`, `PROFESSIONAL`
**Entrada:** `query` (cadena de búsqueda) y el `actor`.
**Precondiciones:** el actor pertenece a `STAFF_ROLES`. Si `query.trim().length < 3`, la operación no ejecuta la consulta a la base y retorna un listado vacío `[]`.
**Efectos:** ninguno. Es una lectura de pacientes activos (`active: true`) con coincidencia parcial insensible a mayúsculas en `lastName` o `firstName`, o coincidencia en `documentNumber`. Incluye la afiliación (`coverage`) con su plan y obra social.
**Errores:** `FORBIDDEN` si el actor no pertenece al personal del centro.
**Revalida:** no aplica.
**Devuelve:** `Patient[]` con `coverage` incluida, ordenados alfabéticamente por apellido y nombre.

No es una Server Action: es una lectura que el Server Component de `/patients` llama directo a la DAL (ADR 0001).

### `getPatient`

**Historia de usuario:** [HU-08 — Buscar y modificar un paciente](hu/HU-08-buscar-modificar-paciente.md)
**Roles:** `RECEPTIONIST`, `MANAGER`, `PROFESSIONAL`
**Entrada:** `id` (identificador numérico del paciente) y el `actor`.
**Precondiciones:** el actor pertenece a `STAFF_ROLES`.
**Efectos:** ninguno. Es una lectura completa de la ficha del paciente, incluyendo su cobertura (`coverage`, plan y obra social) y la información de auditoría de creación y última actualización (`createdBy` y `updatedBy`).
**Errores:** `FORBIDDEN` si el actor no pertenece al personal del centro; `NOT_FOUND` si el paciente no existe.
**Revalida:** no aplica.
**Devuelve:** los datos completos del paciente para renderizar su ficha.

No es una Server Action: es una lectura que el Server Component de `/patients/[id]` llama directo a la DAL (ADR 0001).

### `updatePatient`

**Historia de usuario:** [HU-08 — Buscar y modificar un paciente](hu/HU-08-buscar-modificar-paciente.md)
**Roles:** `RECEPTIONIST`, `MANAGER`
**Entrada:** `id`, `lastName`, `firstName`, `gender`, `documentType`, `documentNumber`, `birthDate`, `phone`, `email`, `coverageType`, `insurancePlanId` (si `coverageType` es `HEALTH_INSURANCE`), `memberNumber` (si `coverageType` es `HEALTH_INSURANCE`), `guardianName` (opcional en general; **obligatorio si la edad derivada de `birthDate` es menor de 16 años**), `guardianPhone` (opcional en general; **obligatorio si la edad derivada de `birthDate` es menor de 16 años**).
**Precondiciones:** el actor es `RECEPTIONIST` o `MANAGER`. El paciente existe. No existe otro paciente distinto con la misma combinación de `documentType` y `documentNumber`. Si `coverageType` es `HEALTH_INSURANCE`, el `insurancePlanId` existe y está activo. Si la edad calculada a partir de `birthDate` es menor de 16 años, `guardianName` y `guardianPhone` son obligatorios (validados por Zod tanto en cliente como en servidor).
**Efectos:** actualiza los datos del `Patient`, registrando `updatedById` con el id del actor y actualizando `updatedAt`. Si `coverageType` es `HEALTH_INSURANCE`, actualiza o crea su `Coverage`. Si la cobertura pasa a `PRIVATE`, remueve la `Coverage` asociada.
**Errores:** `VALIDATION` (campos obligatorios vacíos, formatos inválidos, menor de 16 años sin tutor), `FORBIDDEN` (profesionales u otros roles sin permiso), `NOT_FOUND` (paciente no encontrado), `DUPLICATE_PATIENT` (documento ya registrado en otro paciente).
**Revalida:** `/patients` y `/patients/[id]`.
**Devuelve:** `{ id, firstName, lastName, documentType, documentNumber }`.

### Nota: `signIn` y `signOut` frente a `defineAction`

`defineAction` exige declarar roles, y estas dos operaciones no tienen ninguno que exigir: una corre sin sesión por definición y la otra acepta cualquiera. Ambas siguen igual el resto del flujo del [ADR 0001](adr/0001-server-actions-y-capa-de-acceso-a-datos.md) —validar con Zod, delegar en la DAL, devolver `ActionResult` ante el error— y siguen siendo endpoints POST públicos.

`getSession()` y `requireRole()` no llevan ficha: no son acciones, son las funciones de `src/lib/dal/auth.ts` sobre las que se apoya todo lo demás.
