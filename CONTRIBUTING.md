# Guía de contribución

Convenciones de trabajo en equipo para este repositorio: ramas, commits, Pull Requests y CI. Aplican por igual a personas y a agentes de IA.

## Antes de empezar

```bash
npm ci
cp .env.example .env    # y ajustar los valores si hace falta
npm run db:up
npm run db:generate     # el cliente de Prisma no se commitea
npm run dev
```

Las convenciones de código, arquitectura y dominio están en [`AGENTS.md`](AGENTS.md).

## Ramas

- `master` es la única rama larga y siempre debe quedar funcional. Nadie pushea directo a `master`: todo entra por Pull Request.
- Cada historia de usuario se desarrolla en su propia rama, creada desde `master` actualizada:

  ```bash
  git switch master
  git pull
  git switch -c feature/HU-<numero>-slug-corto
  ```

  Ejemplo: `feature/HU-12-alta-turno`.

- Para lo que no corresponde a una historia, usar el prefijo según el tipo de cambio:

  | Prefijo      | Cuándo                                                           |
  | ------------ | ---------------------------------------------------------------- |
  | `fix/`       | Corrección de un bug                                             |
  | `docs/`      | Cambios solo de documentación                                    |
  | `chore/`     | Configuración, dependencias, CI, tooling                         |

  Ejemplo: `fix/solapamiento-de-turnos`.

- El slug va en minúsculas, con guiones, sin tildes ni `ñ`, y corto.
- La rama vive solo mientras dura el cambio: se borra al mergear el PR.

## Commits

Formato `tipo: descripción` en español, como en el historial del repo:

```
feat: agregar alta de turnos con validación de superposición
fix: corregir cálculo de la duración de la prestación
docs: documentar la ficha de la acción cancelar turno
```

Tipos usados: `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`.

- Un commit por cambio lógico: no mezclar en el mismo commit cosas que no tienen relación (por ejemplo, tooling con un feature).
- Cada commit debería dejar `npm run check` en verde.

## Antes de abrir el PR

1. Correr `npm run check` y dejarlo en verde (formato, lint, tipos y schema de Prisma). Si falla, el PR no se abre: se arregla primero. Si algo falla solo en el CI, ver la nota de `AGENTS.md` sobre `.next/` y `tsconfig.tsbuildinfo`.
2. Si el cambio toca el dominio, actualizar en el mismo cambio `docs/glossary.md` (términos nuevos) y la ficha de `docs/acciones.md` (operaciones nuevas o modificadas).
3. Si el cambio toca `schema.prisma`, incluir la migración (`npm run db:migrate`) y actualizar el diagrama y las tablas de reglas de `docs/modelo-de-datos.md`.
4. Traer los cambios de `master` si hace falta, con un merge (sin rebase ni force-push sobre ramas compartidas):

   ```bash
   git fetch origin master
   git merge origin/master
   ```

## Pull Requests

Abrir el PR de la rama hacia `master`, con el mismo formato de título que los commits:

```bash
git push -u origin <tu-rama>
gh pr create --base master --title "feat: agregar alta de turnos" --body-file <archivo>
```

La descripción tiene que incluir:

- **Qué cambia y por qué**, en pocas líneas.
- **Historia de usuario** que implementa (número y enlace), si corresponde.
- **Cómo probarlo**: pasos concretos para verificar el cambio a mano.
- **Documentación actualizada**: qué archivos de `docs/` se tocaron, o "no aplica".

Para poder mergear, el PR necesita:

- El check `check` del CI en verde.
- Al menos 1 aprobación de otro miembro del equipo. El autor no aprueba su propio PR.

Después de mergear, borrar la rama.

### Ayudar en el PR de otra persona

Todo el equipo tiene permiso de escritura en el repo, así que cualquiera puede sumar commits a la rama de un PR ajeno (por ejemplo, si su autor pidió ayuda y no está disponible):

```bash
git fetch origin
git switch <rama-del-pr>
# ...cambios...
npm run check
git push
```

- Pushear a la misma rama, sin `--force`, para no pisar el trabajo de la otra persona.
- Dejar un comentario en el PR que cuente qué se cambió y por qué.
- Quien sumó commits a un PR ajeno sí puede aprobarlo: la única restricción es que el autor del PR no puede aprobar el propio.
- Solo funciona con ramas de este mismo repo. No trabajar desde forks.

## Reglas para agentes de IA

Además de todo lo anterior:

- Trabajar siempre en una rama propia con el nombre que corresponda; nunca commitear ni pushear a `master`.
- No mergear el PR ni aprobarlo: eso lo hace una persona del equipo.
- No saltear las protecciones de la rama (ni con permisos de administrador, ni con `--force`, ni con `--no-verify`).
- No abrir el PR con `npm run check` en rojo, ni silenciar errores para que pase.
- No hacer push ni abrir el PR sin que la persona que dirige al agente lo haya pedido. Esto incluye pushear a la rama de un PR ajeno: solo si la persona lo pidió, sin `--force` y comentando en el PR qué se cambió.
- Si el PR falla en el CI, leer el log (`gh run view --log-failed`), arreglar la causa y pushear el arreglo a la misma rama.

## Reglas configuradas en GitHub

Están aplicadas como protección de la rama `master` (**Settings → Branches**, o `gh api repos/MauricioLopezC/goat/branches/master/protection`):

- Se requiere Pull Request para mergear.
- Se requiere el check `check` en verde.
- Se requiere 1 aprobación de review.
- Sin force-push ni borrado de la rama.
- Sin restricciones de push sobre las demás ramas: cualquier colaborador con permiso de escritura puede pushear a la rama de un PR ajeno, y la aprobación no exige que el último push sea de otra persona.
- Quien administra el repositorio puede saltearse estas reglas de forma excepcional; el resto del equipo, no.
