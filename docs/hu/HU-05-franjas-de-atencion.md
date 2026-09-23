# HU-05 — Definir los días y horarios de atención de un profesional

**Incremento:** 1 · **Actividad:** Gestión de profesionales

> Como gerente, necesito cargar las franjas de atención semanales de cada profesional, para que el sistema solo ofrezca turnos en horarios en los que realmente atiende.

## Datos

- **Obligatorios por franja:** profesional, día de la semana, hora de inicio, hora de fin.
- **Opcionales:** consultorio o box, servicios habilitados en esa franja.

## Validaciones

- Hora de fin posterior a hora de inicio.
- No se aceptan franjas superpuestas del mismo profesional en el mismo día.
- No se puede eliminar ni acortar una franja si deja turnos programados fuera de horario: el sistema avisa y lista los turnos afectados. Vale también para cambiarla de día o quitarle servicios habilitados.
- Un profesional puede tener varias franjas el mismo día (por ejemplo, lunes de 9 a 13 y de 16 a 20).
- Los servicios habilitados en una franja tienen que ser servicios que presta el profesional. Sin servicios marcados, la franja admite todos los suyos.
- Solo se cargan o modifican franjas de profesionales activos.
- Una excepción o un feriado no se pueden cargar sobre un día u horario con turnos programados: el sistema lista los turnos afectados, que hay que cancelar antes.
- Las excepciones y los feriados se cargan para hoy o una fecha futura.

## Comportamiento

- La agenda se define como patrón semanal y se repite hasta que se modifique.
- Al guardar, el calendario ([HU-11](HU-11-calendario-del-centro.md)) refleja de inmediato los espacios disponibles.
- La grilla de horarios se calcula a partir de la franja. Cada servicio tiene una duración estimada fija, sin importar de cuál se trate.
- Los feriados no generan disponibilidad: el centro permanece cerrado. El gerente los administra en una pantalla propia; el seed trae los nacionales.
- Cada profesional puede tener excepciones a su patrón semanal (ausencias puntuales).
- Solo se pueden asignar turnos hasta dos meses hacia adelante.

## Confirmación

- Vista semanal de las franjas cargadas, para revisar de un vistazo antes de salir.
- Eliminar una franja, una excepción o un feriado pide confirmación.

## Permisos

- `MANAGER`: carga y modifica franjas, excepciones y feriados.
- `PROFESSIONAL`: consulta sus propias franjas y excepciones, no las de otros profesionales. Consulta los feriados.
- `RECEPTIONIST`: solo lectura de todo.

## Operaciones

- `getProfessionalSchedule` — lectura de franjas y excepciones de un profesional.
- `createAvailabilityWindow`, `updateAvailabilityWindow`, `deleteAvailabilityWindow` — franjas del patrón semanal.
- `createAvailabilityException`, `deleteAvailabilityException` — excepciones de agenda del profesional.
- `listHolidays`, `createHoliday`, `deleteHoliday` — feriados del centro.

## A conversar

- Excepciones de agenda (vacaciones, congresos, feriados): la propuesta del equipo era dejarlas fuera del Inc. 1.
  - **Cliente:** si un día es feriado o festivo, el centro permanece cerrado. Las excepciones por profesional se incluyen en el Incremento 1. Se puede asignar un turno hasta dentro de 2 meses.
- ¿Se administran consultorios o boxes como recurso limitado, o cada profesional tiene el suyo?
  - **Cliente:** inicialmente cada profesional tiene su propio consultorio. Se consultará con el cliente.
  - **Supuesto:** el consultorio es opcional y se elige de una lista fija que trae el seed; no se controla que dos profesionales no lo usen a la vez.
- ¿Quién carga los feriados?
  - **Supuesto del equipo:** el gerente, con los nacionales precargados. Así puede sumar días no laborables locales. A confirmar con el cliente.
- ¿Una excepción puede cargarse sobre turnos ya dados?
  - **Supuesto del equipo:** no; se cancelan antes, igual que al acortar una franja. A confirmar con el cliente.
