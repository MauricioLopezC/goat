# HU-03 — Modificar y dar de baja un profesional

**Incremento:** 1 · **Actividad:** Gestión de profesionales

> Como gerente, necesito actualizar los datos de un profesional o darlo de baja, para mantener la información al día sin perder el historial de lo que ya hizo.

## Datos

- **Modificables:** todos los de [HU-02](HU-02-registrar-profesional.md).
- **Obligatorios para la baja:** motivo y fecha de baja.

## Validaciones

- Al modificar matrícula o documento siguen aplicando las reglas de unicidad.
- No se puede quitar un servicio si el profesional tiene turnos futuros programados para ese servicio: el sistema avisa y los lista.
- No se puede dar de baja un profesional con turnos futuros en estado Programado: el sistema avisa cuántos son y ofrece ir a cancelarlos.

## Comportamiento

- La baja es lógica: el profesional pasa a inactivo y deja de aparecer al dar turnos nuevos.
- Sus turnos pasados y su agenda histórica siguen siendo consultables.
- Un profesional inactivo puede reactivarse.
- Queda registrado quién modificó o dio de baja, cuándo y con qué motivo.

## Confirmación

- La baja pide confirmación explícita, mostrando el nombre y advirtiendo que dejará de recibir turnos.
- Mensaje de éxito y actualización del estado en el listado.

## Permisos

- `MANAGER`: modifica y da de baja. Actualiza todos los datos de los profesionales.
- `RECEPTIONIST`: solo lectura.

## Operaciones

- `updateProfessional` — modificación de datos y de servicios asociados.
- `deactivateProfessional` — baja lógica con motivo y fecha.
- `reactivateProfessional` — reactivación.
