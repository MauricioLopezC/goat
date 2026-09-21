# ADR 0002 — Autenticación y sesión

- **Estado:** aceptada
- **Fecha:** 2026-09-21
- **Alcance:** cómo un usuario del centro se autentica, y cómo el servidor sabe quién es y qué rol tiene en cada request.

## Contexto

El [ADR 0001](0001-server-actions-y-capa-de-acceso-a-datos.md) fijó que las reglas de negocio y el acceso a datos viven en la DAL, y dejó explícitamente pendiente la elección de la librería de sesión. Lo que ya quedó decidido ahí y este ADR **no** cambia:

- `getSession()` en `src/lib/dal/auth.ts` es el único punto que conoce el mecanismo de sesión.
- `requireRole(...roles: Role[])` se apoya en `getSession()` y es lo que llaman las acciones y la DAL.
- La autorización (qué rol puede hacer qué, y si el recurso le corresponde) es código propio en la DAL, no de la librería.
- `proxy.ts` solo hace chequeos optimistas leyendo la cookie, y nunca es la única barrera.

Este ADR decide lo que falta: con qué se implementa `getSession()` por dentro.

### Qué pide el dominio

[HU-01](../hu/HU-01-ingresar-al-sistema.md) delimita el problema, y buena parte de la decisión está en lo que el cliente descartó:

| Hace falta | No hace falta |
| --- | --- |
| Ingresar con credenciales | Autorregistro: **solo el gerente crea usuarios** |
| Tres roles con acceso diferenciado | Recuperación de contraseña (*cliente: «no existe»*) |
| Usuario inactivo no puede ingresar | Login social / OAuth |
| Contraseña nunca en texto plano | Verificación por email, 2FA, magic links |
| Trazabilidad: quién hizo cada cosa | Sesiones entre dispositivos, "cerrar sesión en todas partes" |
| Cerrar sesión | |

La columna derecha es casi todo lo que aporta una librería de autenticación. La izquierda es la parte chica y estable.

El sistema tiene un puñado de usuarios internos (mesa de entradas, profesionales, gerente), todos dados de alta a mano por el gerente. No hay un público que se registre solo. La autogestión del paciente figura como **opcional** en el [contexto](../contexto-goat.md) y está fuera del Incremento 1.

Esta decisión se apoya en la documentación de la versión instalada (Next.js 16.3.5): `01-app/02-guides/authentication.md`, en particular su distinción entre chequeos *optimistas* (cookie) y *seguros* (base de datos), y su recomendación de centralizar la verificación de sesión en la DAL.

## Decisión

### 1. Implementación propia, sin librería de autenticación

La sesión se implementa con [`iron-session`](https://github.com/vvo/iron-session) (cookie cifrada y firmada), que la guía de Next recomienda como librería de manejo de sesión. No se adopta una librería de autenticación completa (Better Auth, Auth.js) en el Incremento 1.

### 2. Login con email y contraseña

El identificador de ingreso es el **email**, que pasa a ser obligatorio y único en `User`. Se elimina el campo `username`: con login por email no tiene función, y mantener dos identificadores sería una fuente de ambigüedad.

Consecuencia sobre el modelo, a aplicar en el mismo PR que esta decisión:

- `User.email`: de `String?` a `String @unique` (obligatorio).
- `User.username`: se elimina.
- Actualizar el DER de [`modelo-de-datos.md`](../modelo-de-datos.md) y la migración correspondiente.

### 3. Contraseñas: argon2id

El hash se calcula con `@node-rs/argon2` (argon2id), no con una construcción propia sobre `crypto`. `User.passwordHash` guarda el hash completo con sus parámetros; no se guarda ni se registra la contraseña en ningún lado.

Ante credenciales inválidas, la respuesta es siempre el mismo mensaje genérico y el mismo código de error, sin distinguir si falló el email o la contraseña (HU-01).

### 4. Sesión: cookie sellada, rol verificado contra la base

La cookie (`goat_session`, `httpOnly`, `secure`, `sameSite: "lax"`, TTL de 8 horas, aproximadamente un turno de trabajo) contiene únicamente:

```ts
type SessionPayload = { userId: number; role: Role }
```

El `role` de la cookie existe **solo** para los chequeos optimistas de `proxy.ts` (¿este rol puede siquiera entrar a esta sección?). No es autoritativo.

Toda decisión real de autorización pasa por `getSession()`, que relee el usuario de la base y devuelve `null` si no existe o está inactivo:

```
proxy.ts      →  ¿hay cookie válida? ¿el rol de la cookie puede entrar acá?   (optimista)
getSession()  →  SELECT del usuario: rol y `active` de la base                (autoritativo)
requireRole() →  se apoya en getSession()
```

`getSession()` se memoiza con el `cache()` de React, así que varios componentes de un mismo render comparten una sola consulta por clave primaria.

Releer el estado desde la base —en vez de confiar en el rol de la cookie— hace que dar de baja a un usuario o cambiarle el rol tenga efecto inmediato, sin esperar a que expire su sesión. HU-01 solo exige el chequeo al ingresar; esto es más estricto y cuesta una consulta indexada por request.

### 5. Alta de usuarios

No existe endpoint de registro. `createUser` es una Server Action restringida a `MANAGER`, como cualquier otra operación del sistema, y sigue el flujo del ADR 0001. El gerente fija la contraseña inicial.

No hay recuperación de contraseña: si un usuario la pierde, el gerente se la resetea (decisión del cliente en HU-01).

### 6. Dónde vive cada cosa

```
src/
  lib/
    session.ts          # sellar/abrir la cookie (iron-session). Único lugar que la toca.
    password.ts         # hash y verify con argon2id
    dal/
      auth.ts           # getSession(), requireRole(), signIn(), signOut()
  app/(auth)/login/     # pantalla de login + actions.ts
proxy.ts                # chequeo optimista
```

`SESSION_SECRET` (32 caracteres o más) va en `.env`, con su entrada en `.env.example`. Solo lo lee `src/lib/session.ts`.

## Alternativas descartadas

| Alternativa | Por qué no |
| --- | --- |
| **Better Auth** | Buena librería, pero impone cuatro tablas (`user`, `session`, `account`, `verification`) sobre un modelo de datos ya diseñado y documentado. `verification` queda muerta (no hay verificación por email ni reset), el hash se muda a `account`, y `role`/`active` hay que mapearlos contra su plugin `admin` (que modela `banned`, no `active`). Sumado a los ids `Int`, son cinco configuraciones no-default apiladas para cubrir un requerimiento que el modelo actual ya expresa. Queda como ruta de salida documentada más abajo. |
| **Auth.js (NextAuth v5)** | Su fuerte son los proveedores OAuth, que acá no se usan. El proveedor de credenciales es el camino menos soportado de la librería y termina exigiendo escribir igual la verificación y el manejo de usuarios, con una capa de configuración encima. |
| **Sesión en base de datos** (tabla `Session`) | Permite revocar sesiones individuales, que nadie pidió. Agrega una tabla y una consulta por request. Como `getSession()` ya relee el usuario, dar de baja a alguien lo deja afuera igual: el beneficio real que quedaría es revocar *una* sesión sin desactivar al usuario, un caso que no aparece en ninguna historia. |
| **JWT firmado a mano con `jose`** | Es lo mismo que `iron-session` pero escribiendo a mano el sellado, la expiración y las flags de la cookie. `iron-session` encapsula justo esa parte, que es la más fácil de equivocar. |
| **Confiar en el rol de la cookie** | Evitaría una consulta por request, a cambio de que una baja o un cambio de rol no tengan efecto hasta que la sesión expire. Para un sistema con control de acceso por rol es un riesgo desproporcionado frente a un `SELECT` por clave primaria. |

## Consecuencias

**A favor**

- El modelo de datos no cambia por razones de infraestructura: `User` sigue siendo la única tabla de acceso, con `role` y `active` como enum y booleano propios.
- La superficie de código es chica y entendible de punta a punta: sellar una cookie, hashear una contraseña, releer un usuario.
- No se arrastra configuración para apagar funcionalidad que el cliente descartó explícitamente.
- Las tres funciones que el resto del sistema usa (`getSession`, `requireRole`, y el `actor` que reciben las acciones) son las mismas que fijó el ADR 0001, sin importar qué haya por debajo.

**Restricciones que asumimos**

- **Las flags de la cookie son responsabilidad nuestra.** `httpOnly`, `secure`, `sameSite` y el TTL se configuran en `src/lib/session.ts` siguiendo la guía de Next, y no hay una librería que los imponga. A cambio, no hay tokens de reset ni `state` de OAuth, que son las partes de una implementación propia que suelen romperse de forma peligrosa.
- **No se pueden revocar sesiones individuales.** Cerrar sesión borra la cookie del navegador; un sello robado sigue siendo válido hasta que expire. Con 8 horas de TTL y usuarios internos, el riesgo es acotado. Si aparece la necesidad, se agrega la tabla `Session`.
- **Una consulta por request autenticado.** Es una búsqueda por clave primaria, memoizada por render pass.
- **El email pasa a ser un dato obligatorio del alta.** Hay que confirmarlo con el cliente (ver *A conversar* en HU-01): si algún empleado no tiene email, el gerente tendrá que asignarle uno interno.
- **Cambiar de librería después implica migrar contraseñas.** Mitigado en el punto siguiente.

## Ruta de salida: migrar a Better Auth

Si la autogestión del paciente deja de ser opcional, aparecen de golpe autorregistro, verificación por email y recuperación de contraseña: ahí Better Auth pasa a convenir. La migración es acotada **si se respetan dos cosas desde ahora**:

1. **Ningún módulo fuera de `src/lib/session.ts` y `src/lib/dal/auth.ts` lee la cookie de sesión.** Es la regla que el ADR 0001 ya impone. Si se cumple, migrar es reescribir `getSession()` por dentro; `requireRole`, las páginas y las acciones no se tocan.
2. **El hash es argon2id vía `@node-rs/argon2`.** Better Auth acepta funciones propias de `hash`/`verify` en `emailAndPassword.password`, así que se le pasan las mismas dos funciones de `src/lib/password.ts` y **las contraseñas existentes siguen funcionando**, sin resetear a nadie.

Con eso, la migración queda en: mapear los modelos de Better Auth sobre la tabla `User` existente (`modelName` y `fields`), generar `session`/`account`/`verification` con su CLI, mover cada `passwordHash` a una fila de `account` con `providerId: "credential"`, configurar `advanced.database.generateId: "serial"` para conservar los ids `Int`, y montar `/api/auth/[...all]`.

Ese Route Handler sería la única excepción a la regla 5 del ADR 0001 (Route Handlers solo para consumidores externos): es el transporte propio de la librería, no acceso a datos de la interfaz. Conviene dejarlo anotado en el ADR que acompañe esa migración.

## Referencias

- Arquitectura y contrato de acciones: [ADR 0001](0001-server-actions-y-capa-de-acceso-a-datos.md), [`docs/acciones.md`](../acciones.md)
- Historia: [HU-01 — Ingresar al sistema con mi rol](../hu/HU-01-ingresar-al-sistema.md)
- Nombres de dominio: [`docs/glossary.md`](../glossary.md)
- Next.js 16.3.5: `01-app/02-guides/authentication.md` (chequeos optimistas vs. seguros, DAL), `02-guides/data-security.md`
