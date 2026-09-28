# HU-22 — Ver la ocupación y el ausentismo del centro

**Incremento:** 2 · **Actividad:** Indicadores

> Como gerente, necesito ver la ocupación de la agenda y el ausentismo de los pacientes por período y por profesional, para decidir sin hacer cálculos a mano.

## Datos

- **Ocupación:** minutos ocupados por turnos Programados y Completados sobre los minutos de franja disponibles (sin feriados ni ausencias), en porcentaje.
- **Ausentismo:** turnos Vencidos sobre turnos Completados más Vencidos, en porcentaje.
- **Cancelaciones:** cantidad de turnos Cancelados en el período.
- **Turnos sin cerrar:** turnos Programados cuya hora de fin ya pasó.

## Validaciones

- El período por defecto es el mes en curso; se puede elegir otro mes o un rango de hasta tres meses.
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
- `completeAppointment`, `expireAppointment` — sin cambios.

## A conversar

- El Vencido se marca a mano (Inc. 1): si nadie cierra los turnos, el ausentismo sale mal. Por eso la lista de turnos sin cerrar entra en esta historia.
- **Supuesto del equipo:** estas son las fórmulas de ocupación y ausentismo. A confirmar con el cliente.
- Ingresos por período, demanda por servicio y el tablero del profesional: Inc. 3.
