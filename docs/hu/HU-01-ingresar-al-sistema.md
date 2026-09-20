# HU-01 — Ingresar al sistema con mi rol

**Incremento:** 1 · **Actividad:** Acceso

> Como usuario del centro (mesa de entrada, profesional o gerente), necesito ingresar al sistema con mis credenciales, para acceder solo a las funciones que me corresponden y que quede registro de quién hace cada cosa.

## Datos

- **Obligatorios:** usuario (o email), contraseña.
- **Del usuario, en su alta por el gerente:** apellido, nombre, usuario, contraseña inicial, rol, estado.
- **Opcionales:** teléfono de contacto interno.

## Validaciones

- Usuario y contraseña obligatorios.
- Credenciales inválidas: mensaje genérico, sin indicar cuál de los dos campos falló.
- Usuario inactivo: no puede ingresar, aunque la contraseña sea correcta.
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

La librería de sesión y el modelo de sesión se deciden en un ADR aparte, pendiente ([ADR 0001](../adr/0001-server-actions-y-capa-de-acceso-a-datos.md)). Lo que ya está fijado es que `getSession()` y `requireRole()` viven en `src/lib/dal/auth.ts`.

## A conversar

- ¿Un profesional puede ser también gerente (un usuario con dos roles) o son personas distintas?
  - **Cliente:** el gerente no es un profesional que atienda en este centro. Su único rol es el de gerente.
- ¿Hace falta recuperación de contraseña en el Inc. 1, o alcanza con que el gerente la resetee?
  - **Cliente:** no existe la recuperación de contraseña.
- **Pendiente:** el usuario del sistema no está en [`glossary.md`](../glossary.md). Definir su nombre en código antes de modelarlo.
