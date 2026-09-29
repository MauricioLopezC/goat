import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { Role } from "@/generated/prisma/enums";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { normalizeSearchText } from "@/lib/services";

// ─────────────────────── Tipos de entrada ────────────────────────────

export interface CreatePaymentMethodInput {
  name: string;
}

export interface UpdatePaymentMethodInput {
  id: number;
  name: string;
  active: boolean;
}

// ─────────────────────── Funciones de lectura ──────────────────────────

/**
 * Lista todos los medios de pago (activos e inactivos), ordenados por nombre.
 * Usada por la página de gestión de medios de pago (HU-20).
 */
export async function listPaymentMethods(actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  return prisma.paymentMethod.findMany({
    select: { id: true, name: true, active: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Lista solo los medios de pago activos.
 * Usada por el formulario de cobro de HU-21.
 */
export async function listActivePaymentMethods(actor: Actor) {
  assertRole(actor, Role.RECEPTIONIST, Role.MANAGER);

  return prisma.paymentMethod.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ─────────────────────── Mutaciones (MANAGER) ──────────────────────────

/**
 * Crea un nuevo medio de pago (HU-20).
 *
 * Regla de negocio:
 * - El nombre debe ser único.
 */
export async function createPaymentMethod(
  input: CreatePaymentMethodInput,
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);

  // 1. Verificar unicidad del nombre (insensible a mayúsculas y acentos)
  const trimmedName = input.name.trim();
  const normalizedInput = normalizeSearchText(trimmedName);
  const existingMethods = await prisma.paymentMethod.findMany({
    select: { id: true, name: true },
  });

  const duplicate = existingMethods.find(
    (m) => normalizeSearchText(m.name) === normalizedInput,
  );

  if (duplicate) {
    throw new DomainError(
      "DUPLICATE",
      "Ya existe un medio de pago con ese nombre.",
      { name: ["Ya existe un medio de pago con ese nombre"] },
    );
  }

  return prisma.paymentMethod.create({
    data: { name: trimmedName, active: true },
    select: { id: true, name: true, active: true },
  });
}

/**
 * Actualiza el nombre y el estado de un medio de pago (HU-20).
 *
 * Reglas de negocio:
 * - El nuevo nombre no puede estar tomado por otro medio.
 * - No se puede desactivar el último medio de pago activo.
 */
export async function updatePaymentMethod(
  input: UpdatePaymentMethodInput,
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);

  // 1. Verificar que el medio de pago exista
  const current = await prisma.paymentMethod.findUnique({
    where: { id: input.id },
    select: { id: true, name: true, active: true },
  });

  if (!current) {
    throw new DomainError("NOT_FOUND", "El medio de pago no existe.");
  }

  // 2. Verificar unicidad del nombre (insensible a mayúsculas y acentos, excluyendo a sí mismo)
  const trimmedName = input.name.trim();
  const normalizedInput = normalizeSearchText(trimmedName);
  const otherMethods = await prisma.paymentMethod.findMany({
    where: { id: { not: input.id } },
    select: { id: true, name: true },
  });

  const duplicate = otherMethods.find(
    (m) => normalizeSearchText(m.name) === normalizedInput,
  );

  if (duplicate) {
    throw new DomainError(
      "DUPLICATE",
      "Ya existe un medio de pago con ese nombre.",
      { name: ["Ya existe un medio de pago con ese nombre"] },
    );
  }

  // 3. Verificar que no sea el último activo si se intenta desactivar
  if (current.active && !input.active) {
    const activeCount = await prisma.paymentMethod.count({
      where: { active: true },
    });
    if (activeCount <= 1) {
      throw new DomainError(
        "LAST_ACTIVE_PAYMENT_METHOD",
        "No se puede desactivar el único medio de pago activo. Activá otro primero.",
      );
    }
  }

  return prisma.paymentMethod.update({
    where: { id: input.id },
    data: { name: trimmedName, active: input.active },
    select: { id: true, name: true, active: true },
  });
}
