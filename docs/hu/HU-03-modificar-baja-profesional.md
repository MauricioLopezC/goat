# HU-03 — Modificar y dar de baja un profesional

**Incremento:** 1 · **Actividad:** Gestión de profesionales

> Como gerente, necesito actualizar los datos de un profesional o darlo de baja, para mantener la información al día sin perder el historial de lo que ya hizo.

## Datos

- **Modificables:** todos los de [HU-02](HU-02-registrar-profesional.md).
- **Obligatorios para la baja:** motivo y fecha de baja.
- **Obligatorio al modificar o reactivar:** motivo del cambio.

## Validaciones

- Al modificar matrícula o documento siguen aplicando las reglas de formato de [HU-02](HU-02-registrar-profesional.md) y de unicidad.
- No se puede quitar un servicio si el profesional tiene turnos programados para ese servicio que todavía no comenzaron: el sistema avisa y los lista.
- No se puede dar de baja un profesional con turnos en estado Programado que todavía no comenzaron: el sistema avisa cuántos son y ofrece ir a cancelarlos.
- Desde la ficha, el gerente puede cancelar esos turnos programados indicando motivo y quién lo solicitó, con confirmación explícita. El calendario completo y sus filtros se implementan en [HU-10](HU-10-cancelar-turno.md) y [HU-11](HU-11-calendario-del-centro.md).

## Comportamiento

- La baja es lógica: el profesional pasa a inactivo y deja de aparecer al dar turnos nuevos.
- Desde el listado, la acción **Modificar** abre una pantalla separada de la ficha de consulta. Allí el gerente puede editar los datos, dar de baja o reactivar al profesional.
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
