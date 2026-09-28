# HU-17 — Completar la ficha del paciente

**Incremento:** 2 · **Actividad:** Gestión de pacientes

> Como mesa de entrada, necesito registrar el domicilio y un contacto de emergencia del paciente y ver su cobertura completa en una sola ficha, para tener sus datos a mano cuando hay que ubicarlo o cobrarle.

## Datos

- **Nuevos, opcionales:** domicilio (calle y número, localidad), contacto de emergencia (nombre, teléfono y vínculo), observaciones administrativas.
- **Cobertura:** obra social, plan, número de afiliado y el coseguro del plan ([HU-20](HU-20-aranceles-y-medios-de-pago.md)), solo lectura.
- Los datos de [HU-07](HU-07-registrar-paciente.md) no cambian.

## Validaciones

- Teléfono del contacto de emergencia con formato válido.
- Si se carga el nombre del contacto de emergencia, el teléfono es obligatorio, y al revés.
- Las de [HU-07](HU-07-registrar-paciente.md) y [HU-08](HU-08-buscar-modificar-paciente.md), sin cambios.

## Comportamiento

- El alta ([HU-07](HU-07-registrar-paciente.md)) no se alarga: los campos nuevos se completan después, desde la ficha.
- La ficha agrupa en secciones los datos personales, contacto, cobertura y el historial de turnos ([HU-18](HU-18-historial-de-turnos-del-paciente.md)).
- Cada modificación registra quién la hizo y cuándo, como en [HU-08](HU-08-buscar-modificar-paciente.md).

## Permisos

- `RECEPTIONIST` y `MANAGER`: consultan y modifican.
- `PROFESSIONAL`: consulta, no modifica.

## Operaciones

- `getPatient`, `updatePatient` — suman los campos nuevos.

## A conversar

- En [HU-07](HU-07-registrar-paciente.md) quedaron para la ficha completa: domicilio, contacto de emergencia, coseguro y datos ampliados de cobertura. El cliente anticipó que la iba a pedir en el Inc. 2.
- **Supuesto del equipo:** el coseguro depende del plan, no del paciente ([HU-20](HU-20-aranceles-y-medios-de-pago.md)). A confirmar.
- **Supuesto del equipo:** todos los campos nuevos son opcionales para no frenar el mostrador. A confirmar.
