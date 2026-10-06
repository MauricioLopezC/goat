# HU-30 — Ver mi tablero de profesional

**Incremento:** 3 · **Actividad:** Indicadores

> Como profesional, necesito ver cuántos turnos y pacientes tuve y quiénes son mis pacientes, para conocer mi actividad en el centro sin pedirle datos al gerente.

## Datos

En el período elegido, solo de sus turnos:

- **Turnos totales**, con el porcentaje de Completados, Vencidos y Cancelados.
- **Turnos por servicio.**
- **Cantidad de pacientes** distintos atendidos, y cuántos son nuevos (primer turno Completado con él en el período).
- **Pacientes por sexo**, en porcentaje.
- **Pacientes por edad**, en porcentaje por rango: menores de 18, 18 a 39, 40 a 64, 65 o más.

## Validaciones

- El período por defecto es el mes en curso; se puede elegir otro mes o un rango de hasta tres meses, como en [HU-22](HU-22-indicadores-iniciales.md).
- Sin datos, "sin datos".
- La edad se calcula a la fecha del turno.

## Comportamiento

- Se abre desde el menú; la pantalla inicial del profesional sigue siendo su agenda ([HU-12](HU-12-agenda-del-profesional.md)).
- Los porcentajes se muestran como números o barras simples; no hay gráficos de un solo valor.

## Permisos

- `PROFESSIONAL`: solo sus propios datos. La DAL aplica el filtro.

## Operaciones

- `getProfessionalIndicators` — nueva, de lectura.

## A conversar

- Estaba previsto para el Inc. 3 en [HU-22](HU-22-indicadores-iniciales.md).
- **Decisión del equipo (05/10/2026):** tablero simple: turnos por servicio, turnos totales, cantidad de pacientes y porcentajes útiles, de sexo y de edad. Lo cobrado por sus turnos está en su rendición ([HU-28](HU-28-rendicion-por-profesional.md)).
- ¿Los rangos de edad sirven para traumatología, o el cliente prefiere otros (por ejemplo, separar pediatría)?
