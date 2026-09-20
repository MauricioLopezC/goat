# HU-05 — Definir los días y horarios de atención de un profesional

**Incremento:** 1 · **Actividad:** Gestión de profesionales

> Como gerente, necesito cargar las franjas de atención semanales de cada profesional, para que el sistema solo ofrezca turnos en horarios en los que realmente atiende.

## Datos

- **Obligatorios por franja:** profesional, día de la semana, hora de inicio, hora de fin.
- **Opcionales:** consultorio o box, servicios habilitados en esa franja.

## Validaciones

- Hora de fin posterior a hora de inicio.
- No se aceptan franjas superpuestas del mismo profesional en el mismo día.
- No se puede eliminar ni acortar una franja si deja turnos programados fuera de horario: el sistema avisa y lista los turnos afectados.
- Un profesional puede tener varias franjas el mismo día (por ejemplo, lunes de 9 a 13 y de 16 a 20).

## Comportamiento

- La agenda se define como patrón semanal y se repite hasta que se modifique.
- Al guardar, el calendario ([HU-11](HU-11-calendario-del-centro.md)) refleja de inmediato los espacios disponibles.
- La grilla de horarios se calcula a partir de la franja. Cada servicio tiene una duración estimada fija, sin importar de cuál se trate.
- Los feriados no generan disponibilidad: el centro permanece cerrado.
- Cada profesional puede tener excepciones a su patrón semanal (ausencias puntuales).
- Solo se pueden asignar turnos hasta dos meses hacia adelante.

## Confirmación

- Vista semanal de las franjas cargadas, para revisar de un vistazo antes de salir.

## Permisos

- `MANAGER`: carga y modifica.
- `PROFESSIONAL`: consulta la propia.
- `RECEPTIONIST`: solo lectura.

## Operaciones

- `createAvailabilityWindow`, `updateAvailabilityWindow`, `deleteAvailabilityWindow` — franjas del patrón semanal.
- Excepciones de agenda por profesional: operación a nombrar junto con su modelo.

## A conversar

- Excepciones de agenda (vacaciones, congresos, feriados): la propuesta del equipo era dejarlas fuera del Inc. 1.
  - **Cliente:** si un día es feriado o festivo, el centro permanece cerrado. Las excepciones por profesional se incluyen en el Incremento 1. Se puede asignar un turno hasta dentro de 2 meses.
- ¿Se administran consultorios o boxes como recurso limitado, o cada profesional tiene el suyo?
  - **Cliente:** inicialmente cada profesional tiene su propio consultorio. Se consultará con el cliente.
- **Pendiente:** ni la excepción de agenda ni el consultorio están en [`glossary.md`](../glossary.md). Definir sus nombres en código antes de modelarlos.
