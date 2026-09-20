import { z } from "zod"

// Mensajes de validación en español. Se parte del locale `es` de Zod y se
// reemplazan los casos que llegan a la UI (campo vacío, largo, rango, formato),
// porque los originales son técnicos ("se esperaba texto, recibido indefinido")
// y el regex expone el patrón. Lo que no se cubre acá cae al locale base.
//
// Los schemas deben importar `z` de este módulo y no de "zod": la config de Zod
// es global por instancia del módulo, y así viaja con cualquier bundle
// (servidor, SSR o cliente) que use los schemas. Un mensaje específico de un
// campo (ej. DNI) se pasa en el schema: `z.string().regex(re, "DNI inválido")`.
const base = z.locales.es().localeError

type Issue = Parameters<typeof base>[0]

const REQUIRED = "Este campo es obligatorio"

function plural(n: number, singular: string, pluralForm: string) {
  return n === 1 ? singular : `${n} ${pluralForm}`
}

function friendlyMessage(issue: Issue): string | undefined {
  switch (issue.code) {
    case "invalid_type":
      if (issue.input === undefined || issue.input === null) return REQUIRED
      if (issue.expected === "number") return "Debe ser un número"
      return undefined

    case "invalid_value":
      return issue.values.length > 1 ? "Opción no válida" : undefined

    case "too_small": {
      const min = Number(issue.minimum)
      switch (issue.origin) {
        case "string":
          return min === 1
            ? REQUIRED
            : `Debe tener al menos ${plural(min, "un carácter", "caracteres")}`
        case "array":
        case "set":
          return `Debe tener al menos ${plural(min, "un elemento", "elementos")}`
        case "number":
        case "int":
        case "bigint":
          return issue.inclusive
            ? `Debe ser mayor o igual a ${min}`
            : `Debe ser mayor que ${min}`
        default:
          return undefined
      }
    }

    case "too_big": {
      const max = Number(issue.maximum)
      switch (issue.origin) {
        case "string":
          return `Debe tener como máximo ${plural(max, "un carácter", "caracteres")}`
        case "array":
        case "set":
          return `Debe tener como máximo ${plural(max, "un elemento", "elementos")}`
        case "number":
        case "int":
        case "bigint":
          return issue.inclusive
            ? `Debe ser menor o igual a ${max}`
            : `Debe ser menor que ${max}`
        default:
          return undefined
      }
    }

    case "invalid_format":
      switch (issue.format) {
        case "email":
          return "Correo electrónico inválido"
        case "url":
          return "URL inválida"
        case "date":
          return "Fecha inválida"
        case "time":
          return "Hora inválida"
        case "datetime":
          return "Fecha y hora inválidas"
        case "regex":
          return "Formato inválido"
        default:
          return undefined
      }

    default:
      return undefined
  }
}

z.config({
  localeError: (issue) => friendlyMessage(issue) ?? base(issue),
})

export { z }
