import { Role } from "@/generated/prisma/enums";

// Roles y sus etiquetas. No lleva `server-only` a propósito: lo usan los
// schemas de Zod y los componentes cliente, además de la DAL.

/// Los tres roles que trabajan en el centro. `PATIENT` está declarado en el
/// enum pero no accede al sistema en el Inc. 1.
export const STAFF_ROLES = [
  Role.RECEPTIONIST,
  Role.PROFESSIONAL,
  Role.MANAGER,
] as const;

/// Cómo se nombra cada rol en la interfaz (en español, ver AGENTS.md).
export const ROLE_LABEL: Record<Role, string> = {
  RECEPTIONIST: "Mesa de entradas",
  PROFESSIONAL: "Profesional",
  MANAGER: "Gerente",
  PATIENT: "Paciente",
};
