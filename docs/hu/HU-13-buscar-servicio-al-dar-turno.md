# HU-13 — Buscar el servicio al dar un turno

**Incremento:** 2 · **Actividad:** Gestión de servicios

> Como mesa de entrada, necesito encontrar el servicio escribiendo parte de su nombre o eligiéndolo por especialidad, para dar el turno en segundos, sin recorrer una lista larga con el paciente enfrente.

## Datos

- Por servicio se muestra: nombre como dato principal; especialidad y duración como atributos secundarios, separados del nombre.
- Sin datos nuevos: usa el catálogo de [HU-06](HU-06-catalogo-de-servicios.md).

## Validaciones

- Solo se ofrecen servicios activos.
- La búsqueda no distingue mayúsculas, minúsculas ni tildes ("rodilla" encuentra "Consulta de Rodilla").
- Si ningún servicio coincide, se muestra un mensaje explícito, no una lista vacía.

## Comportamiento

- El selector de servicio del alta de turno ([HU-09](HU-09-asignar-turno.md)) pasa a ser un buscador: filtra mientras se escribe y se usa completo con el teclado (flechas y Enter).
- Sin texto escrito, los servicios aparecen agrupados por especialidad y en orden alfabético.
- Al elegir el servicio, la lista de profesionales se reduce a los que lo prestan, como hasta ahora.
- El mismo buscador se usa en el filtro por servicio del calendario ([HU-11](HU-11-calendario-del-centro.md)).

## Permisos

- Los de [HU-09](HU-09-asignar-turno.md) y [HU-11](HU-11-calendario-del-centro.md), sin cambios.

## Operaciones

- `listActiveServices` — sin cambios de contrato; si hace falta, suma la especialidad de cada servicio.

## A conversar

- Revisión del Inc. 1 (25/09/2026): el cliente marcó que la lista es larga y que, al ver la duración junto al nombre, entendió que un servicio se repetía con distintas duraciones. Sugirió elegir servicio, profesional y duración por separado.
  - **Supuesto del equipo:** la duración sigue siendo la del servicio y mesa de entradas no la cambia en un turno puntual. Se muestra aparte del nombre para que no se lea como parte de él. A confirmar en la revisión del Inc. 2.
- Para probarla con volumen real, el seed pasa a tener un catálogo de alrededor de 40 servicios (aprendizaje del Inc. 1).
