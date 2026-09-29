# Reporte de Code Review

**Fecha:** YYYY-MM-DD  
**Rama:** `<nombre-de-la-rama>`  
**Historia de Usuario:** [HU-XX: Nombre de la historia](file:///path/to/docs/hu/HU-XX-nombre.md) *(o "Fix / Tarea técnica: descripción")*  
**Autor/a:** `<autor o IA>`  
**Veredicto General:** 🟢 APROBADO / 🟡 APROBADO CON OBSERVACIONES / 🔴 REQUIERE CAMBIOS  

---

## 1. Resumen Ejecutivo

*Breve resumen de 2-3 párrafos explicando qué implementa o corrige el cambio, qué se analizó y la conclusión general.*

---

## 2. Matriz de Criterios de Aceptación (HU)

| Sección HU | Criterio / Regla | Estado | Evidencia / Observaciones |
| :--- | :--- | :---: | :--- |
| **Datos** | Campos obligatorios y opcionales según HU | ✅ / ⚠️ / ❌ | *Ubicación en código o comportamiento* |
| **Validaciones** | Reglas de validación y límites en cliente y servidor | ✅ / ⚠️ / ❌ | *Ubicación en código o comportamiento* |
| **Comportamiento** | Flujos, estados vacíos, ordenamiento y paginación | ✅ / ⚠️ / ❌ | *Ubicación en código o comportamiento* |
| **Confirmación** | Diálogos o avisos de confirmación requeridos | ✅ / ⚠️ / ➖ | *Ubicación en código o comportamiento* |
| **Permisos** | Control de acceso por rol (`MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`) | ✅ / ⚠️ / ❌ | *Verificación en DAL, Server Action y UI* |
| **Operaciones** | Implementación de las funciones de la DAL correspondientes | ✅ / ⚠️ / ❌ | *Ubicación en `src/lib/dal/`* |
| **Definition of Done** | Criterios acordados completos y testeables | ✅ / ⚠️ / ❌ | *Verificación general* |

---

## 3. Reglas del Proyecto y Arquitectura

| Regla | Estado | Detalle |
| :--- | :---: | :--- |
| **Convención de idioma** (Código en inglés, UI/Docs en español) | ✅ / ⚠️ / ❌ | *Sin nombres en español en variables/funciones/modelos.* |
| **Glosario de dominio** (`docs/glossary.md`) | ✅ / ⚠️ / ❌ | *Coincidencia de términos de dominio.* |
| **Arquitectura DAL** (`src/lib/dal/*`, `server-only`) | ✅ / ⚠️ / ❌ | *Lógica de negocio en DAL, no en acciones ni páginas.* |
| **Autorización en DAL** (`assertRole` y pertenencia con `actor`) | ✅ / ⚠️ / ❌ | *DAL no confía a ciegas en la acción.* |
| **Server Actions** (`defineAction`, `ActionResult`) | ✅ / ⚠️ / ❌ | *Acciones delgadas, sin bypass.* |
| **Validación Zod** (Import desde `@/lib/validation/zod`) | ✅ / ⚠️ / ❌ | *Mensajes en español garantizados.* |
| **Permisos de ruta** (`requirePageRole` vs `route-access.ts` vs `navigation.ts`) | ✅ / ⚠️ / ❌ | *Coherencia de roles en páginas y navegación.* |
| **Base de datos / Prisma** (Migración y `docs/modelo-de-datos.md`) | ✅ / ➖ / ❌ | *Si tocó schema: migración presente y doc actualizado.* |
| **Documentación de acciones** (`docs/acciones.md`) | ✅ / ➖ / ❌ | *Ficha de operación creada/actualizada.* |
| **Tokens de UI** (`docs/DESIGN.md`, sin colores hex libres) | ✅ / ⚠️ / ❌ | *Tokens semánticos de Tailwind, shadcn preset nova.* |

---

## 4. Buenas Prácticas de Next.js & React

- **Server Components vs Client Components:**  
  *¿Se reservó `"use client"` únicamente para hojas interactivas? ¿Páginas y layouts se mantienen como Server Components?*
- **Flujo de Mutación y Revalidación:**  
  *¿Se llama a `revalidatePath` antes de cualquier `redirect`? ¿Se propagan errores a través de `ActionResult`?*
- **Rendimiento y Seguridad:**  
  *¿Se evitan llamadas en cascada innecesarias? ¿Hay exposición de datos sensibles a componentes de cliente?*

---

## 5. Verificación Técnica Automática

Resultados de la ejecución de validaciones en local:

- **Comando ejecutado:** `npm run check`
- **Formato (`prettier --check .`):** ✅ En verde / ❌ Con diferencias
- **Linter (`eslint`):** ✅ Sin errores / ❌ Con advertencias o errores
- **Tipos (`next typegen && tsc --noEmit`):** ✅ Sin errores de tipo
- **Esquema de BD (`prisma validate`):** ✅ Válido
- **Pruebas (`tsx --test tests/*.test.ts`):** ✅ X pruebas pasadas / ❌ Fallos detectados
- **Silenciamientos:** ✅ Ningún `eslint-disable`, `@ts-ignore` o `any` introducido.

---

## 6. Hallazgos y Acciones Requeridas

### 🔴 Bloqueantes (Must fix)
*(Problemas que impiden la aprobación o merge: violaciones de HU, fallas de permisos, errores en check)*
1. **[Archivo:Línea]** Descripción del problema y cómo corregirlo.

### 🟡 Advertencias (Should fix)
*(Deuda técnica, tokens de estilos incorrectos, detalles de UX o mejoras recomendadas antes del merge)*
1. **[Archivo:Línea]** Descripción de la observación y recomendación.

### 🟢 Sugerencias / Mejoras (Nice to have)
*(Ideas de refactor, simplificación de código o mejoras opcionales de legibilidad)*
1. **[Archivo:Línea]** Sugerencia técnica.

---

## 7. Conclusión y Recomendación

*Dictamen final con los pasos concretos a seguir por el desarrollador para avanzar.*
