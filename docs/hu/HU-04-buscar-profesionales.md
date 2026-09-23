# HU-04 — Buscar y consultar profesionales

**Incremento:** 1 · **Actividad:** Gestión de profesionales

> Como mesa de entrada, necesito buscar un profesional y ver su ficha, para saber qué servicios presta y en qué días y horarios atiende antes de ofrecer un turno.

## Datos

- **En el listado:** apellido y nombre, matrícula, servicios que presta, tipo de profesional, estado.
- **En la ficha:** todos los datos del profesional, más su agenda semanal de franjas.

## Validaciones

- Una búsqueda con menos de 2 caracteres no dispara la consulta.

## Comportamiento

- Búsqueda por apellido, nombre, documento o matrícula, con coincidencia parcial.
- Filtros por servicio y por estado (activo, inactivo, todos).
- Por defecto muestra solo activos, ordenados por apellido.
- Sin resultados: mensaje claro y opción de limpiar filtros.
- El listado ofrece **Ver ficha** para consultar los datos y las franjas semanales; la edición se inicia con una acción separada, disponible para el gerente.

## Permisos

- Los tres roles pueden consultar.

## Operaciones

Historia de solo lectura: no lleva Server Action. Las consultas van en la DAL y se llaman desde Server Components ([ADR 0001](../adr/0001-server-actions-y-capa-de-acceso-a-datos.md)).

- `listProfessionals(filters)`, `getProfessional(id)` en `src/lib/dal/professionals.ts`.
