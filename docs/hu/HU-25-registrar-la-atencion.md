# HU-25 — Registrar la atención

**Incremento:** 3 · **Actividad:** Atención e historial

> Como profesional, necesito anotar qué observé y qué le indiqué al paciente en cada visita, para tenerlo a mano la próxima vez que lo atienda yo u otro colega.

## Datos

- **Obligatorias:** notas de la atención (texto libre).
- **Opcionales:** indicaciones (texto libre: medicación, estudios pedidos, reposo, próximos pasos).
- **Registrados por el sistema:** profesional autor, fecha y hora de alta y de última modificación.

## Validaciones

- Se registra sobre un turno propio Completado, o Programado que ya comenzó. No sobre un turno Cancelado o Vencido.
- Un turno tiene como máximo una atención.
- Solo el autor la modifica, y solo hasta el fin del día siguiente al turno. Después queda fija.

## Comportamiento

- Se carga desde el detalle del turno y desde la agenda del día del profesional ([HU-12](HU-12-agenda-del-profesional.md)), con dos cuadros de texto.
- Si el turno estaba Programado, al guardar pasa a Completado, con su evento en el historial del turno: si hay atención, el paciente vino.
- El turno con atención registrada muestra un ícono en la agenda y en el calendario.
- La atención aparece en la bitácora del paciente ([HU-26](HU-26-bitacora-del-paciente.md)).

## Permisos

- `PROFESSIONAL`: registra y modifica la atención de sus propios turnos.
- `RECEPTIONIST` y `MANAGER`: no la registran ni ven su contenido; ven solo que el turno tiene atención registrada.

## Operaciones

- `createEncounter` — nueva. Completa el turno si estaba Programado.
- `updateEncounter` — nueva. Errores esperados: `FORBIDDEN` (otro autor), plazo vencido.

## A conversar

- Devolución del Inc. 2 (general): el cliente espera "uno o dos bloques de texto" por visita, como una bitácora, y no una historia clínica con tipificación de prácticas o prescripciones. Responde la pregunta abierta 1 de [`contexto-goat.md`](../contexto-goat.md) sobre el nivel de detalle de las prescripciones: texto libre.
- **Decisión del equipo:** no se modela `Prescription`. La prescripción es el campo de indicaciones de la atención.
- **Supuesto del equipo:** el plazo para corregir la atención es hasta el fin del día siguiente. A confirmar.
