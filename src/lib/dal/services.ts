import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { Role } from "@/generated/prisma/enums";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { STAFF_ROLES } from "@/lib/roles";

// ─────────────────────── Tipos de entrada ────────────────────────────

export interface CreateServiceInput {
  name: string;
  durationMinutes: number;
  requiresReferral: boolean;
  description?: string | null;
  specialtyId?: number | null;
}

export interface UpdateServiceInput {
  id: number;
  name: string;
  durationMinutes: number;
  requiresReferral: boolean;
  description?: string | null;
  specialtyId?: number | null;
}

// ─────────────────────── Funciones de lectura ──────────────────────────

/**
 * Devuelve todos los servicios del catálogo (activos e inactivos),
 * ordenados con los activos primero y alfabéticamente por nombre.
 */
export async function listServices(actor: Actor) {
  assertRole(actor, ...STAFF_ROLES);

  return prisma.service.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      requiresReferral: true,
      active: true,
      specialtyId: true,
      specialty: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Devuelve las áreas o especialidades clínicas activas para el formulario.
 */
export async function listActiveSpecialties(actor: Actor) {
  assertRole(actor, ...STAFF_ROLES);

  return prisma.specialty.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
}

// ─────────────────────── Mutaciones (MANAGER) ──────────────────────────

/**
 * Da de alta un nuevo servicio en el catálogo (HU-06).
 */
export async function createService(input: CreateServiceInput, actor: Actor) {
  assertRole(actor, Role.MANAGER);

  // 1. Verificar unicidad de nombre
  const existing = await prisma.service.findUnique({
    where: { name: input.name },
    select: { id: true },
  });

  if (existing) {
    throw new DomainError(
      "DUPLICATE",
      "Ya existe un servicio con ese nombre en el catálogo.",
      { name: ["Ya existe un servicio con ese nombre"] },
    );
  }

  // 2. Si tiene specialtyId, verificar que exista y esté activa
  if (input.specialtyId) {
    const specialty = await prisma.specialty.findUnique({
      where: { id: input.specialtyId, active: true },
      select: { id: true },
    });

    if (!specialty) {
      throw new DomainError(
        "NOT_FOUND",
        "El área médica seleccionada no existe o no está activa.",
        { specialtyId: ["El área médica seleccionada no es válida"] },
      );
    }
  }

  // 3. Crear el servicio
  return prisma.service.create({
    data: {
      name: input.name,
      durationMinutes: input.durationMinutes,
      requiresReferral: input.requiresReferral,
      description: input.description ?? null,
      specialtyId: input.specialtyId ?? null,
      active: true,
    },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      requiresReferral: true,
    },
  });
}

/**
 * Modifica los datos de un servicio existente (HU-06).
 */
export async function updateService(input: UpdateServiceInput, actor: Actor) {
  assertRole(actor, Role.MANAGER);

  // 1. Verificar que el servicio exista
  const current = await prisma.service.findUnique({
    where: { id: input.id },
    select: { id: true, name: true },
  });

  if (!current) {
    throw new DomainError("NOT_FOUND", "El servicio a editar no existe.");
  }

  // 2. Si cambió el nombre, verificar que no esté ocupado
  if (current.name !== input.name) {
    const duplicate = await prisma.service.findUnique({
      where: { name: input.name },
      select: { id: true },
    });

    if (duplicate) {
      throw new DomainError(
        "DUPLICATE",
        "Ya existe otro servicio con ese nombre en el catálogo.",
        { name: ["Ya existe un servicio con ese nombre"] },
      );
    }
  }

  // 3. Si tiene specialtyId, verificar existencia
  if (input.specialtyId) {
    const specialty = await prisma.specialty.findUnique({
      where: { id: input.specialtyId, active: true },
      select: { id: true },
    });

    if (!specialty) {
      throw new DomainError(
        "NOT_FOUND",
        "El área médica seleccionada no existe o no está activa.",
        { specialtyId: ["El área médica seleccionada no es válida"] },
      );
    }
  }

  // 4. Actualizar el servicio
  return prisma.service.update({
    where: { id: input.id },
    data: {
      name: input.name,
      durationMinutes: input.durationMinutes,
      requiresReferral: input.requiresReferral,
      description: input.description ?? null,
      specialtyId: input.specialtyId ?? null,
    },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      requiresReferral: true,
    },
  });
}

/**
 * Realiza la baja lógica de un servicio (HU-06).
 *
 * Regla de negocio:
 * No se puede inactivar un servicio con turnos futuros programados.
 */
export async function deactivateService(id: number, actor: Actor) {
  assertRole(actor, Role.MANAGER);

  const service = await prisma.service.findUnique({
    where: { id },
    select: { id: true, name: true, active: true },
  });

  if (!service) {
    throw new DomainError("NOT_FOUND", "El servicio seleccionado no existe.");
  }

  if (!service.active) {
    return { id: service.id, name: service.name, active: false };
  }

  // Verificar turnos futuros programados (SCHEDULED con startsAt >= ahora)
  const futureAppointments = await prisma.appointment.count({
    where: {
      serviceId: id,
      status: "SCHEDULED",
      startsAt: { gte: new Date() },
    },
  });

  if (futureAppointments > 0) {
    throw new DomainError(
      "UNMET_DEPENDENCY",
      `No se puede inactivar el servicio "${service.name}" porque tiene ${futureAppointments} turno(s) futuro(s) programado(s).`,
    );
  }

  return prisma.service.update({
    where: { id },
    data: { active: false },
    select: {
      id: true,
      name: true,
      active: true,
    },
  });
}

/**
 * Reactiva un servicio previamente dado de baja (HU-06).
 */
export async function activateService(id: number, actor: Actor) {
  assertRole(actor, Role.MANAGER);

  const service = await prisma.service.findUnique({
    where: { id },
    select: { id: true, name: true, active: true },
  });

  if (!service) {
    throw new DomainError("NOT_FOUND", "El servicio seleccionado no existe.");
  }

  if (service.active) {
    return { id: service.id, name: service.name, active: true };
  }

  return prisma.service.update({
    where: { id },
    data: { active: true },
    select: {
      id: true,
      name: true,
      active: true,
    },
  });
}

