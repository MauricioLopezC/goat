# HU-29 — Ver los indicadores del centro

**Incremento:** 3 · **Actividad:** Indicadores

> Como gerente, necesito ver quién atiende más, qué se pide más, cuándo hay más gente y cuánto dinero entra, para decidir dónde reforzar la agenda y cómo repartir los recursos del centro.

## Datos

Se agregan al tablero de [HU-22](HU-22-indicadores-iniciales.md). Cada indicador dice qué decisión apoya:

| Indicador | Cómo se calcula | Decisión que apoya |
|---|---|---|
| **Profesional con más pacientes** | Ranking de profesionales por pacientes distintos atendidos (turnos Completados) | ¿A quién reforzar con horas o un colega del mismo servicio? |
| **Horas trabajadas** | Por profesional, suma de la duración de sus turnos Completados | ¿Las horas atendidas se corresponden con las franjas que tiene abiertas? |
| **Pacientes por profesional** | Pacientes atendidos sobre horas trabajadas, por profesional | ¿Quién tiene más carga por hora? |
| **Pacientes más frecuentes** | Ranking de pacientes por turnos Completados | ¿Quiénes son los pacientes habituales (por ejemplo, series de kinesiología)? |
| **Tasa de cancelación** | Turnos Cancelados sobre turnos dados en el período, del centro y por profesional | ¿Hace falta una política de cancelación o confirmar los turnos? |
| **Ingreso de dinero** | Cobros vigentes del período, por mes y por medio de pago, comparado con el período anterior | ¿Crecen los ingresos? ¿Qué medios se usan? |
| **Servicios más solicitados** | Ranking de servicios por turnos dados | ¿Qué servicios necesitan más profesionales u horas? |
| **Especialidad más solicitada** | Turnos dados agrupados por la especialidad del servicio | ¿Qué línea de atención del policonsultorio crece? |
| **Ocupación de agenda** | La de HU-22: minutos ocupados sobre minutos de franja disponibles | ¿Sobra o falta agenda? |
| **Días más concurridos** | Turnos por día de la semana | ¿Qué días necesitan más mesa de entradas o más profesionales? |

## Validaciones

- Mismo período y filtro por profesional que HU-22. Los rankings muestran los cinco primeros.
- Un indicador sin datos suficientes muestra "sin datos", no un gráfico vacío.

## Comportamiento

- Cada indicador muestra, junto al valor, una **lectura** en una frase calculada con los datos, por ejemplo: "Rodilla concentra el 34 % de los turnos" o "Los martes son el día más concurrido".
- Cada indicador tiene una ayuda con su fórmula y para qué sirve.
- Solo se grafica lo que se compara (rankings, días, meses). Un valor único se muestra como número.

## Permisos

- `MANAGER`: ve el tablero completo.
- `RECEPTIONIST` y `PROFESSIONAL`: sin acceso (el profesional tiene su tablero en [HU-30](HU-30-tablero-del-profesional.md)).

## Operaciones

- `getCenterIndicators` — suma los indicadores de la tabla.

## A conversar

- Devolución del Inc. 2 (general): los indicadores tienen que permitir tomar decisiones y el equipo tiene que poder explicar la conclusión de al menos algunos. Nada de "una barra por elemento".
- **Decisión del equipo (05/10/2026):** los indicadores son los de la tabla.
- El ranking de pacientes muestra nombres al gerente. ¿Está bien, o alcanza con la cantidad de pacientes frecuentes?
