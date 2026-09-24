# HU-01 — Ingresar al sistema con mi rol

**Incremento:** 1 · **Actividad:** Acceso

> Como usuario del centro (mesa de entrada, profesional o gerente), necesito ingresar al sistema con mis credenciales, para acceder solo a las funciones que me corresponden y que quede registro de quién hace cada cosa.

## Datos

- **Obligatorios:** email, contraseña.
- **Del usuario, en su alta por el gerente:** apellido, nombre, email, contraseña inicial, rol, estado.
- **Opcionales:** teléfono de contacto interno.

## Validaciones

- Email y contraseña obligatorios.
- El email tiene formato válido y es único: no puede haber dos usuarios con el mismo.
- Credenciales inválidas: mensaje genérico, sin indicar cuál de los dos campos falló.
- Usuario inactivo: no puede ingresar, aunque la contraseña sea correcta. Si se lo da de baja con la sesión ya abierta, queda afuera en el siguiente movimiento, sin esperar a que la sesión expire.
- La contraseña nunca se guarda en texto plano.

## Comportamiento

- Al ingresar correctamente, el sistema muestra la pantalla inicial del rol: mesa de entrada ve el calendario del día del centro; el profesional ve su propia agenda del día; el gerente ve el listado de profesionales (en el Inc. 2 pasa a ser el tablero).
- Toda creación, modificación o cancelación queda asociada al usuario que la ejecutó.
- Existe opción de cerrar sesión desde cualquier pantalla.

## Permisos

- Un profesional autenticado ve solo su propia agenda, no la de sus colegas.
- Solo el gerente crea usuarios y asigna roles.

## Operaciones

Previstas; cada ficha se escribe en [`acciones.md`](../acciones.md) al implementarla.

- `signIn`, `signOut` — inicio y cierre de sesión.
- `createUser` — alta de usuario con rol, solo `MANAGER`.
- `listUsers` — listado de usuarios del centro, paginado de a 10, solo `MANAGER`. Lectura, no acción.

La sesión está decidida en el [ADR 0002](../adr/0002-autenticacion-y-sesion.md): cookie sellada con `iron-session`, contraseñas con argon2id y el rol verificado contra la base en cada request. `getSession()` y `requireRole()` viven en `src/lib/dal/auth.ts`, como fijó el [ADR 0001](../adr/0001-server-actions-y-capa-de-acceso-a-datos.md).

## A conversar

- ¿Un profesional puede ser también gerente (un usuario con dos roles) o son personas distintas?
  - **Cliente:** el gerente no es un profesional que atienda en este centro. Su único rol es el de gerente.
- ¿Hace falta recuperación de contraseña en el Inc. 1, o alcanza con que el gerente la resetee?
  - **Cliente:** no existe la recuperación de contraseña.
- El ingreso es por email, que pasa a ser obligatorio y único en el alta ([ADR 0002](../adr/0002-autenticacion-y-sesion.md)). ¿Todo el personal del centro tiene una casilla propia? Si alguno no tiene, el gerente le asigna una interna al darlo de alta.
- La historia no fija política de contraseñas ni qué pasa ante intentos fallidos repetidos. Al escribir las fichas se asumió un mínimo de 8 caracteres y ningún bloqueo por intentos. Confirmar con el cliente: ¿alcanza para el centro, o quiere un mínimo distinto o que la cuenta se bloquee tras N intentos?
