# HU-06 — Administrar los servicios que presta el centro

**Incremento:** 1 · **Actividad:** Catálogo de servicios

> Como gerente, necesito definir los servicios del policonsultorio con duración fija y por igual para todos, para que los turnos se den con el tiempo correcto según lo que se va a hacer.

## Datos

- **Obligatorios:** nombre del servicio, duración en minutos fija, estado (activo o inactivo), requiere orden médica (sí o no).
- **Opcionales:** descripción, área (columna, rodilla, mano, pie, infantil, deporte, kinesiología).

## Validaciones

- Nombre único.
- Duración mayor a cero y múltiplo del intervalo de grilla del centro. En el Inc. 1 todos los servicios duran 30 minutos.
- No se puede inactivar un servicio con turnos futuros programados.

## Comportamiento

- Los servicios activos son los que se ofrecen al dar un turno.
- Cada servicio se asocia a uno o más profesionales, desde [HU-02](HU-02-registrar-profesional.md) y [HU-03](HU-03-modificar-baja-profesional.md).
- La duración del servicio determina el bloque que se ocupa en la agenda.

## Confirmación

- Mensaje de éxito y el servicio aparece en el listado.

## Permisos

- `MANAGER`: administra.
- `RECEPTIONIST` y `PROFESSIONAL`: solo lectura.

## Operaciones

- `createService`, `updateService`, `deactivateService`.

## Nota INVEST

Es habilitante de [HU-09](HU-09-asignar-turno.md): sin catálogo no se puede dar un turno por servicio, que es lo que pide la pantalla clave. Tiene valor visible para el cliente porque define la oferta del centro, así que va como historia y no como tarea técnica.

## Nota de alcance

La duración fija de 30 minutos es una decisión del Inc. 1, no del modelo: `Service` guarda su propia duración desde el principio, según el riesgo registrado en [`contexto-goat.md`](../contexto-goat.md) §13.
