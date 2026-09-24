# HU-08 — Buscar y modificar un paciente

**Incremento:** 1 · **Actividad:** Gestión de pacientes

> Como mesa de entrada, necesito encontrar rápido a un paciente y corregir sus datos, para atender a alguien que ya vino antes sin volver a cargarlo.

## Datos

- Búsqueda por número de documento, apellido o nombre, con coincidencia parcial en apellido y nombre.
- El listado muestra apellido y nombre, documento, fecha de nacimiento, teléfono y cobertura.

## Validaciones

- Menos de 3 caracteres no dispara la búsqueda.
- Al modificar el documento se revalida la unicidad.
- Las mismas validaciones de formato que en el alta ([HU-07](HU-07-registrar-paciente.md)).

## Comportamiento

- Resultados ordenados por apellido, de a 10 por página, con el total de pacientes encontrados. Una búsqueda nueva vuelve a la primera página.
- Sin resultados: mensaje claro y acceso directo a registrar un paciente nuevo, con el texto buscado ya precargado.
- Desde el resultado se puede abrir la ficha, editarla o dar un turno.
- Cada modificación registra usuario, fecha y hora.

## Permisos

- `RECEPTIONIST` y `MANAGER`: buscan y modifican.
- `PROFESSIONAL`: busca y consulta, no modifica.

## Operaciones

- `updatePatient` — modificación de datos y cobertura.
- Búsqueda y ficha son lecturas: `searchPatients(query, page)`, `getPatient(id)` en `src/lib/dal/patients.ts`, llamadas desde Server Components.

## Nota de alcance

La baja de pacientes no entra en el Inc. 1. Es una decisión a registrar: en un centro médico es poco frecuente y arrastra reglas de historial que todavía no existen.
