---
name: Goat — Gestión de turnos para policonsultorio de traumatología
colors:
  # Marca
  primary: '#0D47A1'
  primary-hover: '#0A387E'
  primary-active: '#082C63'
  info: '#00838F'
  warning: '#E65100'
  success: '#00897B'
  destructive: '#C62828'
  # Variantes suaves (badges, avisos): fondo / borde / texto
  primary-soft: '#EAEDFF'
  primary-soft-border: '#B0C6FF'
  primary-soft-foreground: '#0D47A1'
  info-soft: '#E0F7FA'
  info-soft-border: '#80DEEA'
  info-soft-foreground: '#006064'
  warning-soft: '#FFF3E0'
  warning-soft-border: '#FFE082'
  warning-soft-foreground: '#BF360C'
  success-soft: '#E0F2F1'
  success-soft-border: '#80CBC4'
  success-soft-foreground: '#00695C'
  destructive-soft: '#FFEBEE'
  destructive-soft-border: '#FFCDD2'
  destructive-soft-foreground: '#C62828'
  # Neutros (escala slate)
  foreground: '#0F172A'
  muted-foreground: '#475569'
  placeholder: '#94A3B8'
  background: '#F8FAFC'
  card: '#FFFFFF'
  tray: '#F1F5F9'
  border: '#E2E8F0'
  border-strong: '#CBD5E1'
typography:
  display-lg:   { fontFamily: Geist, fontSize: 32px, fontWeight: '700', lineHeight: 40px, letterSpacing: -0.02em }
  headline-lg:  { fontFamily: Geist, fontSize: 24px, fontWeight: '600', lineHeight: 32px, letterSpacing: -0.015em }
  headline-md:  { fontFamily: Geist, fontSize: 20px, fontWeight: '600', lineHeight: 28px, letterSpacing: -0.01em }
  headline-sm:  { fontFamily: Geist, fontSize: 18px, fontWeight: '600', lineHeight: 24px, letterSpacing: -0.005em }
  title-lg:     { fontFamily: Geist, fontSize: 16px, fontWeight: '600', lineHeight: 22px, letterSpacing: 0em }
  title-md:     { fontFamily: Geist, fontSize: 14px, fontWeight: '600', lineHeight: 20px, letterSpacing: 0.005em }
  body-lg:      { fontFamily: Geist, fontSize: 15px, fontWeight: '400', lineHeight: 24px, letterSpacing: 0em }
  body-md:      { fontFamily: Geist, fontSize: 14px, fontWeight: '400', lineHeight: 20px, letterSpacing: 0em }
  body-sm:      { fontFamily: Geist, fontSize: 13px, fontWeight: '400', lineHeight: 18px, letterSpacing: 0.005em }
  label-md:     { fontFamily: Geist, fontSize: 12px, fontWeight: '500', lineHeight: 16px, letterSpacing: 0.02em }
  label-sm:     { fontFamily: Geist, fontSize: 11px, fontWeight: '600', lineHeight: 14px, letterSpacing: 0.04em }
  code-sm:      { fontFamily: JetBrains Mono, fontSize: 12px, fontWeight: '500', lineHeight: 16px, letterSpacing: 0em }
rounded:
  control: 0.25rem
  card: 0.5rem
  modal: 0.75rem
  full: 9999px
spacing:
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

> Diseño específico de Goat, derivado del diseño genérico "Clinical Traumatology & Orthopedic System".
> El tema vive en `src/app/globals.css` y **debe mantenerse sincronizado con este documento**: si cambia un color acá, cambia allá (y viceversa).
> Nombres de estados, roles y entidades: ver `glossary.md`.

## Marca y estilo

Goat es una herramienta **administrativa y ambulatoria**: el usuario más intensivo es mesa de entradas, con el paciente enfrente y presión de tiempo (criterio de éxito: un turno completo en menos de un minuto). La interfaz prioriza claridad, calma y densidad de información legible.

Estilo: **minimalismo de precisión clínica** — bordes definidos, superficies limpias, sin ruido de alertas. El rojo se reserva para lo urgente; nada más grita.

## Colores

| Rol | Color | Uso |
|---|---|---|
| **Primario** `#0D47A1` (azul zafiro) | `primary` | Navegación activa, acciones principales, selección, foco. |
| **Info** `#00838F` (cian diagnóstico) | `info` | Turnos programados, etiquetas informativas, acciones secundarias técnicas. |
| **Advertencia** `#E65100` (ámbar) | `warning` | Turnos vencidos, avisos que requieren atención sin ser críticos. |
| **Éxito** `#00897B` (verde recuperación) | `success` | Turno completado, pagado, confirmaciones completadas. |
| **Crítico** `#C62828` | `destructive` | Urgencia/prioridad, errores de validación, acciones destructivas. |

**Superficies:** lienzo `#F8FAFC` (`background`), tarjetas y paneles `#FFFFFF` (`card`), bandejas/columnas laterales `#F1F5F9` (`tray`, `muted`, `sidebar`), bordes `#E2E8F0` (`border`) y `#CBD5E1` (`input`, bordes de paneles activos).

### Estado del turno → color

| `AppointmentStatus` | Badge (fondo suave) | Borde izquierdo del bloque en agenda |
|---|---|---|
| `SCHEDULED` (Programado) | `info-soft` | `info` |
| `COMPLETED` (Completado) | `success-soft` | `success` |
| `CANCELLED` (Cancelado) | neutro: `muted` + `border-input` + texto `muted-foreground` | `#94A3B8` (`placeholder`) |
| `EXPIRED` (Vencido) | `warning-soft` | `warning` |

La **urgencia/prioridad** es independiente del estado: se marca con un badge `destructive-soft` "Urgente". No se pinta de rojo el bloque entero.

Los estados de pago (Incremento 2) se definirán cuando se modelen.

### Accesibilidad de color

- Texto pequeño sobre fondo suave usa siempre el token `*-soft-foreground`. `warning-soft-foreground` es `#BF360C` y no `#E65100`: este último da 3.5:1 sobre `#FFF3E0` y no llega a AA.
- Los fondos sólidos `warning` (`#E65100`) y `success` (`#00897B`) con texto blanco quedan por debajo de 4.5:1. Usarlos solo con texto grande/negrita, íconos o indicadores; para etiquetas con texto chico, usar la variante suave.
- `muted-foreground` es `#475569`. El placeholder de los inputs (`#94A3B8`) no cumple AA y no debe usarse para información necesaria.

## Tipografía

**Geist** en toda la interfaz. **JetBrains Mono** para datos de identificación y códigos: documento del paciente, número de afiliado, números de comprobante.

- Escala definida en el tema como utilidades `text-display-lg`, `text-headline-md`, `text-title-md`, `text-body-md`, `text-label-sm`, `text-code-sm`, etc. Tamaño base de la app: `body-md` (14 px).
- **Cifras tabulares** (`tabular-nums`) en horarios, duraciones, importes y cualquier columna numérica.
- **Labels y metadatos:** `label-sm` / `label-md` en mayúsculas (`uppercase`) para encabezados de tarjeta, columnas de tabla y etiquetas de estado.
- Texto largo (observaciones, indicaciones) en `body-md` regular sobre `#FFFFFF` o `#F8FAFC`.

## Layout y espaciado

Grilla de 12 columnas.

- **Móvil (< 768 px):** una columna, margen `1rem`. Los módulos secundarios pasan a paneles inferiores.
- **Tablet (768–1199 px):** 8 columnas, margen `1.5rem`, gutter `1rem`.
- **Escritorio (≥ 1200 px):** 12 columnas, gutter `1.5rem`, margen `2rem`. Flujo de tres paneles para mesa de entradas y profesional: **navegación** (col. 1–2) · **agenda / listado** (col. 3–8) · **detalle del turno o paciente** (col. 9–12).

**Densidad:** tablas densas con `space-xs` vertical y `space-sm` horizontal. Formularios con `space-md` de padding interno y `space-lg` entre secciones.

## Elevación

Profundidad por **bordes de bajo contraste** y sombras tenues teñidas de slate. Priorizar el borde sobre la sombra.

| Nivel | Uso | Estilo | Token |
|---|---|---|---|
| 0 | Lienzo | Plano `#F8FAFC`, sin borde | — |
| 1 | Tarjetas, superficies de datos | `#FFFFFF`, borde `#E2E8F0`, `0 1px 3px 0 rgba(15,23,42,.05)` | `shadow-sm` |
| 2 | Paneles activos, dropdowns | `#FFFFFF`, borde `#CBD5E1`, `0 4px 12px -2px rgba(15,23,42,.08), 0 2px 6px -1px rgba(15,23,42,.04)` | `shadow-md` |
| 3 | Modales de confirmación | `#FFFFFF` sobre fondo `rgba(15,23,42,.5)`, `0 12px 28px -4px rgba(15,23,42,.16)` | `shadow-lg` |

## Formas

| Elemento | Radio | Clase (preset shadcn `nova`) |
|---|---|---|
| Controles: botones, inputs, selects, badges | 4 px | `rounded-lg` |
| Tarjetas y paneles | 8 px | `rounded-xl` |
| Modales, drawers, bandejas | 12 px | `rounded-2xl` |
| Puntos de estado, avatares, contadores | círculo | `rounded-full` (única excepción a la regla de no usar píldoras) |

## Componentes

- **Botón primario:** fondo `primary`, texto blanco, hover `#0A387E`, active `#082C63`. Alto 38 px (32 px dentro de tablas). Tipografía `label-md` medium.
- **Botón secundario:** fondo blanco, texto y borde `primary`, hover `#F0F4FA`.
- **Botón crítico:** fondo `destructive`, hover `#A81F1F`. Solo para acciones destructivas (cancelar un turno, dar de baja).
- **Badges de estado:** fondo `*-soft`, borde `*-soft-border`, texto `*-soft-foreground`, `label-sm`, radio 4 px. Ver tabla de estados.
- **Inputs:** alto 38 px, fondo blanco, borde `#CBD5E1`, radio 4 px, `body-md`. Foco: borde `primary` + anillo `rgba(13,71,161,.15)`. Error: borde `destructive` + anillo `rgba(198,40,40,.15)`.
- **Checkbox / radio:** 16×16 px, borde `1.5px #94A3B8`, marcado en `primary`.
- **Tarjeta de paciente / turno:** fondo blanco, borde `#E2E8F0`, radio 8 px, padding `space-md`–`space-lg`. Encabezado: título en `label-md` mayúsculas, documento en `code-sm` (JetBrains Mono) y badge de estado alineado a la derecha.

### Componentes propios del dominio

- **Bloque de turno en agenda:** ítem con **borde izquierdo de 4 px** según estado (ver tabla). Muestra horario (tabular), paciente, prestación y profesional; badge "Urgente" si corresponde.
- **Franja de atención:** en el calendario, las horas fuera de la franja del profesional se muestran sobre `tray` y no aceptan turnos (refuerza la regla de no turnos fuera de horario).
- **Indicador de ocupación / ausentismo:** pista de doble capa (`#E2E8F0` base, relleno `success` o `primary`) con el porcentaje en Geist negrita tabular. Base para el tablero de gerencia y del profesional.

## Implementación (shadcn/ui + Tailwind 4)

- Preset **shadcn `radix-nova`** (Radix + Lucide). Componentes en `src/components/ui`, agregados con `npx shadcn@latest add <componente>`.
- Usar **tokens semánticos**, nunca hex sueltos: `bg-primary`, `text-muted-foreground`, `border-input`, `bg-success-soft text-success-soft-foreground border-success-soft-border`.
- Solo **tema claro**. `dark:` está atado a la clase `.dark`, que no se usa; el modo oscuro no está diseñado.
- Al agregar estos componentes, ajustar el radio para cumplir la tabla de Formas: `badge` (`rounded-4xl` → `rounded-lg`) y `dialog`/`sheet`/`drawer` (`rounded-xl` → `rounded-2xl`). Las tarjetas ya salen a 8 px con `rounded-xl`.
- Alto de controles: 38 px por defecto (`h-9.5`) al ajustar `button` e `input`.
- **Navegación:** `Sidebar` de shadcn a la izquierda, sobre `sidebar` (`#F1F5F9`), con el link activo en `sidebar-primary`. Se pliega en escritorio (recuerda el estado en la cookie `sidebar_state`) y en móvil pasa a un panel lateral. Los links y los roles que ven cada uno están en `src/lib/navigation.ts`; qué rol puede abrir cada ruta, en `src/lib/route-access.ts`. El contenido se limita a `max-w-6xl`; una página que necesita todo el ancho (el calendario) lo pide con `data-layout="wide"` en su contenedor raíz. En `sidebar.tsx`, `tooltip.tsx` y `skeleton.tsx` se pasó `rounded-md` a `rounded-lg` (4 px, controles); los textos de `sidebar.tsx` y `sheet.tsx` están en español.

## Qué se quitó del diseño genérico

El diseño base apunta a un entorno hospitalario y quirúrgico. Se eliminó lo que Goat no tiene (y que el contexto declara fuera de alcance): visor radiológico y PACS, inventario de implantes, clasificación AO/OTA, MRN/ICD-10, triage de traumatología nivel 1, medidor de rango de movimiento y flujo quirúrgico de tres paneles con inspector radiológico. La paleta, la tipografía, la elevación y el sistema de formas se conservan.
