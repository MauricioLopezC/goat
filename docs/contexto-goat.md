# Contexto del producto — Sistema de gestión de turnos
**Bloque A · Centro de traumatología (policonsultorio)**

---

## 1. Identificación

**Producto:** sistema de gestión de turnos y atención ambulatoria para un centro traumatológico.

**Cliente:** el profesor actúa como cliente del centro. La evaluación es desde ese rol, no desde el rol de docente técnico.

**Una línea:** software que permite a un policonsultorio de traumatología registrar pacientes, administrar la agenda de sus profesionales, dar y reprogramar turnos por prestación, registrar la atención y los cobros, y medir cómo funciona el centro.

---

## 2. Situación y problema

El centro atiende de forma **ambulatoria y programada**. Hoy la agenda se lleva en papel/planillas, lo que genera:

- Turnos superpuestos o asignados fuera del horario real del profesional.
- Pacientes que llegan y no hay registro de su obra social o de la orden/autorización.
- Ausentismo alto sin forma de medirlo ni de reasignar el espacio liberado.
- Historial de atención disperso: el profesional no ve qué se le hizo antes al paciente.
- Cobros sin trazabilidad: no se sabe cuánto entró por período ni qué quedó pendiente.
- El gerente no tiene información para decidir (ocupación, ausentismo, ingresos).

> Estos puntos son **supuestos de relevamiento** del equipo, no afirmaciones del audio. Hay que dejarlos documentados como tales y validarlos con el cliente.

---

## 3. Objetivos

**Del negocio**
- Reducir turnos perdidos (ausencias y cancelaciones tardías).
- Aprovechar mejor la agenda de los profesionales.
- Tener visibilidad de ingresos y de deuda por consulta.
- Dar respuesta rápida en mostrador, sobre todo en casos de urgencia/prioridad.

**Del producto**
- Una única fuente de verdad de la agenda del centro.
- Registro completo y consistente del paciente y su cobertura.
- Trazabilidad de cada turno: quién lo dio, quién lo modificó, quién lo canceló y por qué.
- Indicadores accionables para gerencia y para cada profesional.

---

## 4. Contexto de dominio: policonsultorio de traumatología

El cliente pidió explícitamente formato **policonsultorio**: varios profesionales y varias líneas de atención dentro de la especialidad traumatología, no un consultorio único.

**Servicios / áreas posibles** (a definir por el grupo):
- Traumatología general
- Columna
- Rodilla y artroscopía
- Hombro
- Mano y muñeca
- Pie y tobillo
- Traumatología infantil
- Medicina del deporte
- Kinesiología y rehabilitación
- Prácticas: yesos e inmovilizaciones, infiltraciones, curaciones, retiro de puntos

**Tipos de turno** (esto es lo que hace interesante al dominio, porque no todos duran lo mismo ni valen lo mismo):
- Primera consulta
- Control / seguimiento
- Control post-quirúrgico
- Práctica (yeso, infiltración, curación)
- Sesión de kinesiología (suele venir en series o packs)
- Urgencia / prioridad

**Cobertura:** particular u obra social. Si es obra social, entran plan, número de afiliado, y eventualmente orden médica / autorización y coseguro.

---

## 5. Glosario

| Término | Significado en este producto |
|---|---|
| **Turno** | Reserva de un espacio de agenda de un profesional, para un paciente, con una prestación asociada. |
| **Prestación / servicio** | Lo que efectivamente se hace en el turno (consulta, control, yeso, sesión de kinesiología). Determina duración y valor. |
| **Franja de atención** | Rango horario en que un profesional atiende un día determinado (ej. martes 9–13). |
| **Sobreturno** | Turno encajado fuera de la grilla normal, típicamente por urgencia. |
| **Obra social / plan / afiliado** | Cobertura del paciente y su identificación dentro de esa cobertura. |
| **Coseguro / copago** | Monto que paga el paciente aunque tenga cobertura. |
| **Prescripción médica** | Indicación que deja el profesional tras atender: receta, pedido de estudios, indicaciones, reposo. |
| **Historial del paciente** | Cronología de atenciones, prestaciones, fechas y prescripciones. |
| **Estado del turno** | Programado → Confirmado → Atendido, o Cancelado, o Ausente. |

---

## 6. Actores

| Actor | Qué necesita | Frecuencia | Obligatorio |
|---|---|---|---|
| **Mesa de entradas** | Registrar pacientes, dar/modificar/cancelar turnos, ver agenda del día, cobrar | Todo el día, con el paciente enfrente | Sí |
| **Profesional (traumatólogo/kinesiólogo)** | Ver su agenda, el historial del paciente, registrar la atención y prescripciones, ver sus indicadores | Varias veces al día | Sí |
| **Gerente del centro** | Controlar ocupación, ausentismo, cancelaciones e ingresos; administrar profesionales y servicios | Diaria/semanal | Sí |
| **Paciente** | Sacar o cancelar su turno por sí mismo | Eventual | **Opcional** |

Nota: mesa de entradas es el usuario más intensivo y con más presión de tiempo. Las decisiones de UX del Incremento 1 deberían optimizarse para él.

---

## 7. Capacidades del producto (backbone)

Estas son las **columnas** del mapa de historias. Todavía no son historias ni backlog.

1. **Gestión de pacientes** — datos filiatorios, documento, contacto, obra social/plan/afiliado, estado.
2. **Gestión de profesionales** — datos identificatorios, matrícula, especialidades/servicios que presta, días y horarios de atención, alta/baja.
3. **Gestión de servicios y prestaciones** — qué ofrece el centro, duración y valor de cada prestación.
4. **Gestión de turnos** — asignar turno considerando servicio, profesional, obra social, prioridad/urgencia; modificar, reprogramar y cancelar con motivo.
5. **Calendario** — visualización por día/semana/mes, con filtros y búsquedas por profesional, servicio, estado, rango de fechas y paciente.
6. **Atención e historial** — registrar la atención, las prestaciones realizadas, observaciones y prescripciones médicas; consultar la cronología del paciente.
7. **Gestión de pagos** — registrar cobros con **varios medios de pago**, estados de pago, y su relación con el turno y la cobertura.
8. **Indicadores** — tablero del profesional y tablero de gerencia.

Transversal: **auditoría/trazabilidad** (quién hizo qué y cuándo) y **control de acceso por rol**.

---

## 8. Alcance

**Dentro**
- Todo lo listado en la sección 7.
- Tres roles obligatorios con permisos diferenciados.
- Acceso del paciente como opcional, sólo si el tiempo lo permite.

**Fuera (explícitamente no lo hacemos)**
- Historia clínica electrónica completa, con estudios por imágenes o integración PACS.
- Facturación electrónica / AFIP y presentación de lotes a obras sociales.
- Liquidación de honorarios a profesionales y sueldos.
- Stock e insumos.
- Telemedicina o videoconsulta.
- App móvil nativa.
- Firma digital de recetas / receta electrónica normativa.
- Multi-sede.

Dejar el "fuera de alcance" escrito es importante: el cliente evalúa equilibrio entre complejidad, calidad y tiempo, y esto muestra decisiones conscientes.

---

## 9. Decisiones ya confirmadas por el cliente

| # | Decisión | Origen |
|---|---|---|
| D-01 | Somos **Bloque A**: centro de atención médica. | Consigna |
| D-02 | Cada grupo elige la especialidad. **Elegimos traumatología**. | 00:47 |
| D-03 | El centro funciona como **policonsultorio**. | Aclaración del profe |
| D-04 | La **gestión de profesionales puede ser completa en el Incremento 1**. | Aclaración del profe |
| D-05 | Debe haber **varios medios de pago**. | Aclaración del profe |
| D-06 | El turno considera **servicio, prioridad/urgencia y obra social**. Esto ya no es una duda. | Pantalla clave |
| D-07 | El **historial incluye prescripciones médicas**. Aparece en la pantalla clave y no estaba en el audio. | Pantalla clave |
| D-08 | La guía del cliente **no** incluye historias de usuario: las define el equipo. | 08:07–12:35 |

---

## 10. Plan de incrementos

Tres entregas de **una semana** cada una.

| | Incremento 1 | Incremento 2 | Incremento 3 |
|---|---|---|---|
| Pacientes | Inicial | Completa | Completa (ajustes) |
| Profesionales | **Completa** | — | Ajustes |
| Turnos | Inicial | Completa | Completa |
| Calendario | Sí (base) | Completo | Completo |
| Pagos | — | Se inicia | Completa |
| Indicadores | — | Iniciales | Completos |
| Historial / prescripciones | — | A definir | Completo |

Criterio del cliente para el Incremento 1: **algo funcional y útil de punta a punta**, antes que muchas pantallas a medias. Y advertencia explícita: si en el Inc. 1 sólo hacemos el alta del paciente, en el Inc. 2 va a pedir la ficha completa (10:54).

Falta ubicar **historial y prescripciones** en un incremento. No figura explícitamente en la grilla de la pantalla clave, pero sí en los procesos principales.

---

## 11. Restricciones

- Una semana por incremento, con el equipo trabajando en paralelo a otras materias.
- El cliente evalúa la **demo funcional** y la **documentación**, y en el examen hay que poder explicar lo hecho.
- Hay que **documentar mientras se desarrolla**, no al final.
- El mapa de historias debe versionarse por incremento.
- Stack tecnológico: a definir por el equipo (pendiente).

---

## 12. Criterios de éxito

Del producto:
- Mesa de entradas puede dar un turno completo en menos de un minuto.
- El sistema impide turnos superpuestos y fuera de franja horaria.
- Ningún turno queda sin trazabilidad de quién lo creó o modificó.
- El gerente obtiene ocupación, ausentismo e ingresos sin cálculos manuales.

De la entrega:
- Cada incremento es demostrable de punta a punta.
- Cada decisión de recorte está registrada con su justificación.

---

## 13. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sobre-alcance en el Inc. 1 | Entrega incompleta | Definir "gestión inicial" de paciente con campos mínimos y cerrarlo |
| Modelo de turno rígido (no contempla prestación ni duración variable) | Retrabajo en Inc. 2 | Modelar prestación y duración desde el Inc. 1, aunque la UI sea simple |
| Pagos y obra social mezclados sin criterio | Confusión en Inc. 2 | Separar conceptualmente valor de prestación, cobertura y lo que paga el paciente |
| Prescripciones subestimadas | Queda afuera y el cliente lo reclama | Confirmar nivel de detalle esperado |
| Documentación al final | Mala nota en examen | Registro de decisiones desde el día 1 |

---

## 14. Preguntas abiertas para el cliente

1. ¿Qué nivel de detalle espera en **prescripciones médicas**? ¿Texto libre, o receta/pedido de estudios/indicaciones/reposo separados?
2. ¿Se contemplan **sobreturnos** para urgencias, o la urgencia sólo marca prioridad dentro de la grilla normal?
3. ¿La **kinesiología** entra como servicio del centro, con sesiones en serie?
4. ¿El **historial** debe estar disponible desde el Incremento 2 o recién en el 3?
5. ¿Qué se espera del acceso **opcional del paciente**? ¿Sólo sacar turno, o también cancelar y ver su historial?
6. ¿La **imagen o diapositiva mencionada en ~01:11** del audio aporta requisitos adicionales?
7. ¿Necesita el centro manejar **valores/aranceles por prestación**, o alcanza con registrar el importe cobrado?
