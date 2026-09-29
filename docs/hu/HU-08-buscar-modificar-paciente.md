# HU-08 — Buscar y modificar un paciente

**Incremento:** 1 · **Actividad:** Gestión de pacientes

> Como mesa de entrada, necesito encontrar rápido a un paciente y corregir sus datos, para atender a alguien que ya vino antes sin volver a cargarlo.

## Datos

- Sin texto buscado, la pantalla lista todos los pacientes.
- Búsqueda por número de documento, apellido o nombre, con coincidencia parcial en apellido y nombre.
- El listado muestra apellido y nombre, documento, fecha de nacimiento, teléfono y cobertura.

## Validaciones

- Menos de 3 caracteres no filtra: se sigue viendo el listado completo, con un aviso.
- El tipo y el número de documento no se modifican una vez creado el paciente. En la edición se muestran como dato fijo, y `updatePatient` rechaza un cambio de documento aunque llegue en una llamada directa a la acción.
- El resto de los datos lleva las mismas validaciones de formato que en el alta ([HU-07](HU-07-registrar-paciente.md)).

## Comportamiento

- La pantalla es un listado: sin texto buscado muestra todos los pacientes; el buscador filtra esa misma tabla.
- Ordenado del registrado más recientemente al más antiguo, con o sin búsqueda, igual que la lista de pacientes del alta de turno. De a 10 por página, con el total de pacientes. Una búsqueda nueva, o limpiar el buscador, vuelve a la primera página.
- Sin resultados: mensaje claro y acceso directo a registrar un paciente nuevo, con el texto buscado ya precargado.
- Desde el resultado se puede abrir la ficha, editarla o dar un turno.
- Cada modificación registra usuario, fecha y hora.

## Permisos

- `RECEPTIONIST` y `MANAGER`: buscan y modifican.
- `PROFESSIONAL`: busca y consulta, no modifica.

## Operaciones

- `updatePatient` — modificación de datos y cobertura (sin el documento).
- Listado, búsqueda y ficha son lecturas: `searchPatients(query, page)`, `getPatient(id)` en `src/lib/dal/patients.ts`, llamadas desde Server Components.

## Ajustes

- **Inc. 2 — Listado de pacientes** ([ajustes de HU-08](../incrementos/2.md#ajustes-de-hu-08)): la pantalla pasó de mostrar solo el buscador a listar todos los pacientes, del más reciente al más antiguo, y el buscador filtra ese listado.
- **Inc. 2 — El documento no se modifica** ([ajustes de HU-08](../incrementos/2.md#ajustes-de-hu-08)): antes se podían cambiar el tipo y el número de documento revalidando la unicidad; ahora quedan fijos una vez creado el paciente.

## Nota de alcance

La baja de pacientes no entra en el Inc. 1. Es una decisión a registrar: en un centro médico es poco frecuente y arrastra reglas de historial que todavía no existen.
