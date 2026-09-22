# HU-07 — Registrar un paciente nuevo

**Incremento:** 1 · **Actividad:** Gestión de pacientes

> Como mesa de entrada, necesito registrar un paciente con sus datos mínimos, para poder asignarle un turno en el momento, sin demorar la atención en el mostrador.

## Datos

- **Obligatorios:** apellido, nombre, género (lista precargada: masculino, femenino, otro), tipo de documento, número de documento, fecha de nacimiento, teléfono, email de contacto, cobertura (particular u obra social), estado (activo o inactivo).
- **Opcionales en este incremento:** obra social, plan, coseguro, número de afiliado; nombre y teléfono del responsable o tutor.
- **Fuera del Inc. 1**, van a la ficha completa del Inc. 2: domicilio, contacto de emergencia, datos ampliados de cobertura.

## Validaciones

- No se permite otro paciente con el mismo tipo y número de documento: el sistema avisa del duplicado, muestra el paciente existente y ofrece abrirlo en lugar de crear uno nuevo.
- Fecha de nacimiento no puede ser futura.
- Teléfono con formato válido.
- Email con formato válido.
- Si se elige cobertura por obra social, entonces obra social, plan, coseguro y número de afiliado pasan a ser obligatorios.
- Campo obligatorio vacío: se marca el campo y no se guarda nada.

## Comportamiento

- El paciente queda en estado activo.
- Queda registrado quién lo creó y cuándo.
- Desde el alta se puede pasar directo a dar un turno para ese paciente.

## Confirmación

- Mensaje de éxito con apellido, nombre y documento del paciente creado.
- Acción sugerida en pantalla: "Dar turno a este paciente".
- El paciente aparece de inmediato en la búsqueda ([HU-08](HU-08-buscar-modificar-paciente.md)).

## Permisos

- `RECEPTIONIST` y `MANAGER`: crean.
- `PROFESSIONAL`: solo lectura.

## Operaciones

- `createPatient` — alta con su `Coverage` cuando la cobertura es por obra social.

## A conversar

- El cliente ya anticipó que si el Inc. 1 es solo el alta mínima, en el Inc. 2 va a pedir la ficha completa.
- Pacientes menores de edad: ¿hace falta registrar responsable o tutor desde el Inc. 1? En traumatología infantil puede aparecer temprano.
  - **Cliente:** el nombre del responsable o tutor y su teléfono de contacto son campos opcionales para estos casos.
