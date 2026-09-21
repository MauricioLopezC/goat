# Acciones: convención y catálogo

Contrato de las Server Actions de Goat y catálogo de operaciones. La decisión de fondo está en [ADR 0001](adr/0001-server-actions-y-capa-de-acceso-a-datos.md).

Los nombres de código (modelos, roles, estados, funciones) siguen [`glossary.md`](glossary.md). La documentación va en español y el código en inglés.

## Estructura

```
src/
  app/<route>/actions.ts     # "use server": adaptadores finos, una acción por operación
  lib/
    dal/                     # import "server-only": autorización, reglas de negocio, Prisma
      auth.ts                #   getSession(), requireRole()
      appointments.ts        #   createAppointment(), cancelAppointment(), ...
    validation/              # schemas Zod, fuente única de la entrada
      zod.ts                 #   `z` con los mensajes en español (único import de "zod")
    actions/                 # ActionResult, ErrorCode, DomainError, defineAction
```

- Las rutas y los archivos van en inglés (`appointments`, no `turnos`).
- Solo la DAL importa `prisma` y lee `process.env`. Las páginas y las acciones no acceden a la base directamente.
- La regla de negocio vive en la función de la DAL, no en la acción. La ficha especifica la operación y se implementa en la DAL.

## Flujo obligatorio de una acción

1. **Sesión y rol:** `requireRole(...)`. La sesión se verifica dentro de cada acción aunque `proxy.ts` ya la haya chequeado.
2. **Validar entrada** con el schema Zod de `src/lib/validation/`. Zod valida la forma. La pertenencia del recurso (por ejemplo, que el turno sea de la agenda del profesional que lo invoca) se verifica en la DAL.
3. **Llamar a la DAL**, que aplica la regla de negocio y escribe con Prisma.
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

_Todavía no hay operaciones especificadas._
