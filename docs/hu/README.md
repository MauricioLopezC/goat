# Historias de usuario

Una historia por archivo. Este índice dice qué historias existen y a qué incremento pertenecen; nada más.

**Dónde vive cada cosa**

| | Dónde |
|---|---|
| Qué pide una historia y sus criterios de aceptación | `docs/hu/HU-XX-*.md` (este directorio) |
| Prioridad, estado, quién la toma | **Trello** |
| Objetivo, estimación, riesgos y cierre de un incremento | [`docs/incrementos/`](../incrementos/) |
| Contrato de cada operación | [`docs/acciones.md`](../acciones.md) |
| Nombres de dominio en código | [`glossary.md`](../glossary.md) |

El repositorio guarda la especificación, que es estable. Trello guarda el estado, que cambia todos los días. Nada de lo que se mueve a diario entra acá.

## Índice

| ID | Historia | Actividad | Inc. |
|---|---|---|---|
| [HU-01](HU-01-ingresar-al-sistema.md) | Ingresar al sistema con mi rol | Acceso | 1 |
| [HU-02](HU-02-registrar-profesional.md) | Registrar un profesional | Profesionales | 1 |
| [HU-03](HU-03-modificar-baja-profesional.md) | Modificar y dar de baja un profesional | Profesionales | 1 |
| [HU-04](HU-04-buscar-profesionales.md) | Buscar y consultar profesionales | Profesionales | 1 |
| [HU-05](HU-05-franjas-de-atencion.md) | Definir los días y horarios de atención | Profesionales | 1 |
| [HU-06](HU-06-catalogo-de-servicios.md) | Administrar los servicios que presta el centro | Servicios | 1 |
| [HU-07](HU-07-registrar-paciente.md) | Registrar un paciente nuevo | Pacientes | 1 |
| [HU-08](HU-08-buscar-modificar-paciente.md) | Buscar y modificar un paciente | Pacientes | 1 |
| [HU-09](HU-09-asignar-turno.md) | Asignar un turno | Turnos | 1 |
| [HU-10](HU-10-cancelar-turno.md) | Cancelar un turno | Turnos | 1 |
| [HU-11](HU-11-calendario-del-centro.md) | Ver el calendario de turnos del centro | Calendario | 1 |
| [HU-12](HU-12-agenda-del-profesional.md) | Ver mi agenda completa | Calendario | 1 |

Las historias se agregan al final, ordenadas por número. No se reordena la tabla: el orden de trabajo lo decide Trello.

## Formato de una historia

Media carilla, en español, con estas secciones (método de *Proyectos Ágiles con Scrum*, Alaimo & Salías):

- **Historia** en formato Cohn: rol + funcionalidad + beneficio.
- **Datos** — obligatorios, opcionales y los que quedan fuera del incremento.
- **Validaciones** — reglas que el sistema hace cumplir.
- **Comportamiento** — qué pasa al ejecutar la acción.
- **Confirmación** — qué ve el usuario al terminar. Solo en altas, bajas y acciones destructivas.
- **Permisos** — qué puede hacer cada rol.
- **Operaciones** — las funciones de la DAL que la implementan, con su ficha en [`acciones.md`](../acciones.md).
- **A conversar** — lo que falta cerrar con el cliente, con su respuesta cuando ya la dio.

Una historia es una invitación a la conversación, no una especificación cerrada: lo que no está acordado va a *A conversar*, no se inventa.

**El diseño técnico no va acá.** El modelo de datos vive en `prisma/schema.prisma`, el contrato de cada operación en `acciones.md`, las decisiones de arquitectura en `docs/adr/` y la interfaz en `docs/DESIGN.md`.

## Definition of Ready

Una historia entra al incremento cuando:

- Cumple INVEST, o está explícitamente marcada para dividirse.
- Tiene criterios de aceptación acordados con el cliente.
- Sus puntos de *A conversar* están resueltos o convertidos en supuestos documentados.
- No depende de otra historia sin desarrollar.

## Definition of Done

Una historia está terminada cuando:

- Todos sus criterios de aceptación funcionan en el ambiente de demo.
- Los permisos por rol están verificados con los tres usuarios.
- `npm run check` pasa y el código está en `master` por Pull Request aprobado.
- La ficha de cada operación está en `acciones.md`, y el glosario tiene los términos nuevos.
- Sus decisiones y recortes quedaron registrados en el documento del incremento.
- El cliente la aprobó en la revisión del incremento.
