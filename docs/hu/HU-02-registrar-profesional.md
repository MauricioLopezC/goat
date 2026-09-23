# HU-02 — Registrar un profesional

**Incremento:** 1 · **Actividad:** Gestión de profesionales

> Como gerente del centro, necesito dar de alta un profesional con su matrícula y los servicios que presta, para poder asignarle turnos.

## Datos

- **Obligatorios:** apellido, nombre, tipo y número de documento, matrícula profesional, tipo de profesional, al menos un servicio que presta, estado (activo por defecto).
- **Opcionales:** teléfono, email, foto, observaciones.

## Validaciones

- No se permiten dos profesionales con el mismo número de documento.
- No se permiten dos profesionales con la misma matrícula.
- El DNI debe tener 8 dígitos numéricos; el pasaporte, entre 8 y 20 letras o números sin espacios. LC, LE y CI admiten entre 6 y 8 dígitos numéricos.
- La matrícula es numérica, de 1 a 8 dígitos; si no valida, se marca el campo.
- Debe seleccionarse al menos un servicio del catálogo ([HU-06](HU-06-catalogo-de-servicios.md)).
- Campo obligatorio vacío: se marca el campo y no se guarda nada.

## Comportamiento

- Al guardar, el profesional queda activo pero sin agenda, hasta que se le carguen franjas horarias ([HU-05](HU-05-franjas-de-atencion.md)).
- Un profesional sin franjas no aparece como opción al dar un turno.
- Queda registrado quién lo creó y cuándo.

## Confirmación

- Mensaje de éxito con el nombre del profesional creado.
- El sistema abre su ficha con acceso directo a "Cargar horarios de atención".
- Aparece de inmediato en el listado ([HU-04](HU-04-buscar-profesionales.md)).

## Permisos

- `MANAGER`: crea.
- `RECEPTIONIST` y `PROFESSIONAL`: solo lectura.

## Operaciones

- `createProfessional` — alta con sus `Service` asociados.

## A conversar

- ¿Hay un formato obligatorio de matrícula (MP/MN) o es texto libre?
  - **Cliente:** el texto ingresado debe ser numérico, de 1 a 8 dígitos.
- ¿Hace falta distinguir traumatólogo de kinesiólogo como tipo de profesional, o alcanza con los servicios que presta?
  - **Cliente:** es necesario identificar al profesional con su título de profesión, además de los servicios que presta. Si posee más de un título, pueden seleccionarse más de una opción.
- **Pendiente:** el título o tipo de profesional no está en [`glossary.md`](../glossary.md). Definir su nombre en código antes de modelarlo.
