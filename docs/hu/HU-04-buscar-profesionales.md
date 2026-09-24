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
- Por defecto muestra todos los estados, ordenados por apellido. Al limpiar los filtros vuelve a mostrar todos.
- El listado se pagina de a 10 profesionales, con el total de resultados. Cambiar la búsqueda o un filtro vuelve a la primera página.
- Sin resultados: mensaje claro y opción de limpiar filtros.
- El listado ofrece **Ver ficha** para consultar los datos y las franjas semanales; la edición se inicia con una acción separada, disponible para el gerente.

## Permisos

- `MANAGER` y `RECEPTIONIST`: buscan en el listado y consultan cualquier ficha.
- `PROFESSIONAL`: no ve el listado. Consulta solo su propia ficha, a la que llega desde *Mis horarios* ([HU-05](HU-05-franjas-de-atencion.md)). La ficha de otro profesional trae sus turnos con pacientes, que [HU-12](HU-12-agenda-del-profesional.md) le reserva a cada uno.

## Operaciones

Historia de solo lectura: no lleva Server Action. Las consultas van en la DAL y se llaman desde Server Components ([ADR 0001](../adr/0001-server-actions-y-capa-de-acceso-a-datos.md)).

- `listProfessionalsPage(filters, page)`, `getProfessional(id)` en `src/lib/dal/professionals.ts`. `listProfessionals(filters)` devuelve la lista completa para los selectores de profesional.

## A conversar

- ¿El profesional necesita consultar a sus colegas (por ejemplo, para derivar un paciente)?
  - **Supuesto del equipo:** no. La historia decía que los tres roles consultan, pero la ficha expone los turnos y pacientes de otro profesional. Se restringe al propio profesional hasta confirmarlo con el cliente.
