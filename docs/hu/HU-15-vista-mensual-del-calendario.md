# HU-15 — Ver el calendario por mes

**Incremento:** 2 · **Actividad:** Calendario

> Como mesa de entrada, necesito ver el mes completo del centro, para responder rápido qué días tienen lugar cuando un paciente pide un turno más adelante.

## Datos

- Por día: cantidad de turnos Programados y Completados, cantidad de bloques libres, y si el centro está cerrado, con su descripción.

## Validaciones

- Los días pasados muestran sus turnos, pero no ofrecen bloques libres (igual que [HU-11](HU-11-calendario-del-centro.md)).
- Los días fuera del horizonte de dos meses no ofrecen bloques libres.

## Comportamiento

- Se suma la vista **mes** al calendario del centro ([HU-11](HU-11-calendario-del-centro.md)) y a la agenda del profesional ([HU-12](HU-12-agenda-del-profesional.md)).
- Respeta los filtros de profesional y servicio. Con filtro de servicio, los bloques libres se cuentan con la duración de ese servicio.
- Los días cerrados ([HU-14](HU-14-cerrar-el-centro.md)) aparecen pintados.
- Al hacer clic en un día se abre la vista día de esa fecha.
- Navegación al mes anterior y siguiente, y acceso rápido al mes actual. La vista y el mes quedan en la dirección de la página.

## Permisos

- Los de [HU-11](HU-11-calendario-del-centro.md) y [HU-12](HU-12-agenda-del-profesional.md), sin cambios.

## Operaciones

- `listAppointments`, `listAvailabilityWindows`, `getProfessionalAgenda` — sin cambios de contrato; se piden con el rango del mes.

## A conversar

- Recorte del Inc. 1 en [HU-11](HU-11-calendario-del-centro.md) y [HU-12](HU-12-agenda-del-profesional.md). El cliente no la pidió en la revisión: es la primera candidata a recortarse si falta tiempo.
