# HU-22 — Ver la ocupación y el ausentismo del centro

**Incremento:** 2 · **Actividad:** Indicadores

> Como gerente, necesito ver la ocupación de la agenda y el ausentismo de los pacientes por período y por profesional, para decidir sin hacer cálculos a mano.

## Datos

- **Ocupación:** minutos ocupados por turnos Programados y Completados sobre los minutos de franja disponibles (sin feriados ni ausencias), en porcentaje. Solo cuenta la parte del turno que cae dentro de la franja disponible, así que nunca pasa del 100 %.
- **Ausentismo:** turnos Vencidos sobre turnos Completados más Vencidos, en porcentaje.
- **Cancelaciones:** cantidad de turnos Cancelados en el período.
- **Turnos sin cerrar:** turnos Programados cuya hora de fin ya pasó.

## Validaciones

- El período por defecto es el mes en curso; se puede elegir otro mes o un rango de meses completos, de hasta tres meses.
- El período abarca todos sus días, también los que todavía no pasaron: la ocupación del mes en curso incluye los turnos Programados futuros.
- Un turno pertenece al período por su fecha de inicio. Las cancelaciones también se cuentan así, no por el día en que se canceló el turno.
- Sin turnos cerrados en el período, el ausentismo muestra "sin datos", no 0 %.

## Comportamiento

- El **tablero** es la pantalla inicial del gerente (cumple lo previsto en [HU-01](HU-01-ingresar-al-sistema.md)).
- Muestra los indicadores del centro y una tabla por profesional con los mismos valores. Filtro por profesional.
- Avisa cuántos turnos del período siguen sin cerrar, porque el ausentismo no los cuenta.
- **Lista de turnos sin cerrar:** mesa de entradas y el gerente ven los turnos pasados que siguen Programados, de a 10, del más viejo al más nuevo, y los marcan Completado o Vencido desde ahí con las reglas de [HU-11](HU-11-calendario-del-centro.md). El calendario muestra un acceso con la cantidad pendiente.

## Permisos

- `MANAGER`: ve el tablero y la lista de turnos sin cerrar.
- `RECEPTIONIST`: ve la lista de turnos sin cerrar; no ve el tablero.
- `PROFESSIONAL`: sin acceso en este incremento (su tablero es del Inc. 3).

## Operaciones

- `getCenterIndicators` — indicadores por período, del centro y por profesional.
- `listUnclosedAppointments` — turnos pasados que siguen Programados, paginados.
- `countUnclosedAppointments` — cantidad de turnos sin cerrar, para el acceso del calendario.
- `completeAppointment`, `expireAppointment` — sin cambios.

## A conversar

- El Vencido se marca a mano (Inc. 1): si nadie cierra los turnos, el ausentismo sale mal. Por eso la lista de turnos sin cerrar entra en esta historia.
  - **Propuesta del equipo (01/10/2026)**, a conversar con el cliente ([#55](https://github.com/MauricioLopezC/goat/issues/55)): en los sistemas reales el turno se cierra como parte del flujo del día, no desde una lista. Vencer automáticamente los turnos Programados al cierre del día (con un evento a nombre del sistema), completar el turno al cobrarlo y, opcionalmente, registrar la llegada del paciente (Presente). La lista de turnos sin cerrar quedaría como vista de corrección.
  - Preguntas: ¿un turno no cerrado al fin del día pasa solo a Vencido, y con qué tolerancia? ¿Cobrar implica que el paciente fue atendido? ¿Quieren registrar la llegada del paciente?
- ¿Son estas las fórmulas de ocupación y ausentismo?
  - **Decisión del equipo (28/09/2026):** sí. Cada indicador muestra su fórmula como ayuda en el tablero.
- Ingresos por período, demanda por servicio y el tablero del profesional: Inc. 3.
- **Supuestos del equipo (01/10/2026)**, a validar con el cliente en la demo:
  - No se guarda el historial de franjas, solo el patrón semanal vigente. Para un período pasado, los minutos disponibles se calculan con las franjas de hoy. Si un profesional cambió sus horarios, la ocupación de esos meses es aproximada.
  - Un profesional dado de baja suma minutos de franja solo hasta su fecha de baja. La tabla muestra a los profesionales con franjas o turnos en el período.
  - El cierre del centro no cancela turnos ([HU-14](HU-14-cerrar-el-centro.md)). Un turno en un día cerrado cuenta para el ausentismo y las cancelaciones, pero no suma ocupación: ese día no hay minutos disponibles.
