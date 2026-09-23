import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import {
  Role,
  ProfessionalEventType,
  AppointmentStatus,
  type DocumentType,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { assertRole, type Actor } from "@/lib/dal/auth";
import { STAFF_ROLES } from "@/lib/roles";

// ─────────────────────── Tipos de entrada ────────────────────────────

export interface CreateProfessionalInput {
  lastName: string;
  firstName: string;
  documentType: DocumentType;
  documentNumber: string;
  licenseNumber: string;
  titleIds: number[];
  serviceIds: number[];
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}

// ─────────────────── createProfessional ──────────────────────────────

/**
 * Da de alta un profesional con sus títulos y servicios asociados.
 *
 * Reglas de negocio (HU-02):
 * - No puede haber dos profesionales con el mismo (documentType, documentNumber).
 * - No puede haber dos profesionales con la misma licenseNumber.
 * - Todos los titleIds deben corresponder a ProfessionalTitle activos.
 * - Todos los serviceIds deben corresponder a Service activos.
 * - El profesional queda activo pero sin franjas de atención.
 */
export async function createProfessional(
  input: CreateProfessionalInput,
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);

  // ── 1. Verificar que no exista un profesional con el mismo documento ──
  const existingByDocument = await prisma.professional.findUnique({
    where: {
      documentType_documentNumber: {
        documentType: input.documentType,
        documentNumber: input.documentNumber,
      },
    },
    select: { id: true },
  });

  if (existingByDocument) {
    throw new DomainError(
      "DUPLICATE",
      "Ya existe un profesional con ese tipo y número de documento.",
      { documentNumber: ["Ya existe un profesional con ese documento"] },
    );
  }

  // ── 2. Verificar que no exista un profesional con la misma matrícula ──
  const existingByLicense = await prisma.professional.findUnique({
    where: { licenseNumber: input.licenseNumber },
    select: { id: true },
  });

  if (existingByLicense) {
    throw new DomainError(
      "DUPLICATE",
      "Ya existe un profesional con esa matrícula.",
      { licenseNumber: ["Ya existe un profesional con esa matrícula"] },
    );
  }

  // ── 3. Verificar que los títulos existan y estén activos ──────────────
  const titles = await prisma.professionalTitle.findMany({
    where: { id: { in: input.titleIds }, active: true },
    select: { id: true },
  });

  if (titles.length !== new Set(input.titleIds).size) {
    throw new DomainError(
      "NOT_FOUND",
      "Uno o más títulos profesionales no existen o no están activos.",
    );
  }

  // ── 4. Verificar que los servicios existan y estén activos ────────────
  const services = await prisma.service.findMany({
    where: { id: { in: input.serviceIds }, active: true },
    select: { id: true },
  });

  if (services.length !== new Set(input.serviceIds).size) {
    throw new DomainError(
      "NOT_FOUND",
      "Uno o más servicios no existen o no están activos.",
    );
  }

  // ── 5. Crear el profesional con títulos y servicios asociados ─────────
  const professional = await prisma.professional.create({
    data: {
      lastName: input.lastName,
      firstName: input.firstName,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      licenseNumber: input.licenseNumber,
      phone: input.phone ?? null,
      email: input.email ?? null,
      photoUrl: input.photoUrl ?? null,
      notes: input.notes ?? null,
      active: true,
      createdBy: { connect: { id: actor.id } },
      titles: {
        connect: Array.from(new Set(input.titleIds)).map((id) => ({ id })),
      },
      services: {
        connect: Array.from(new Set(input.serviceIds)).map((id) => ({ id })),
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  return professional;
}

export interface UpdateProfessionalInput extends CreateProfessionalInput {
  id: number;
  reason: string;
}

export async function getProfessional(id: number, actor: Actor) {
  assertRole(actor, ...STAFF_ROLES);
  const professional = await prisma.professional.findUnique({
    where: { id },
    include: {
      titles: { select: { id: true, name: true } },
      services: { select: { id: true, name: true, durationMinutes: true } },
      events: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      appointments: {
        where: {
          status: AppointmentStatus.SCHEDULED,
          startsAt: { gt: new Date() },
        },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          startsAt: true,
          service: { select: { name: true } },
          patient: { select: { firstName: true, lastName: true } },
        },
      },
      availabilityWindows: {
        select: {
          id: true,
          weekday: true,
          startMinute: true,
          endMinute: true,
          room: { select: { name: true } },
          services: { select: { id: true, name: true } },
        },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      },
    },
  });
  if (!professional)
    throw new DomainError("NOT_FOUND", "El profesional no existe.");
  return professional;
}

export async function updateProfessional(
  input: UpdateProfessionalInput,
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  return prisma.$transaction(
    async (tx) => {
      const current = await tx.professional.findUnique({
        where: { id: input.id },
        include: {
          services: { select: { id: true } },
          titles: { select: { id: true } },
        },
      });
      if (!current)
        throw new DomainError("NOT_FOUND", "El profesional no existe.");

      const duplicate = await tx.professional.findFirst({
        where: {
          id: { not: input.id },
          OR: [
            {
              documentType: input.documentType,
              documentNumber: input.documentNumber,
            },
            { licenseNumber: input.licenseNumber },
          ],
        },
        select: {
          documentType: true,
          documentNumber: true,
          licenseNumber: true,
        },
      });
      if (duplicate) {
        const document =
          duplicate.documentType === input.documentType &&
          duplicate.documentNumber === input.documentNumber;
        throw new DomainError(
          "DUPLICATE",
          document
            ? "Ya existe un profesional con ese documento."
            : "Ya existe un profesional con esa matrícula.",
          document
            ? { documentNumber: ["Documento ya registrado"] }
            : { licenseNumber: ["Matrícula ya registrada"] },
        );
      }

      const [titles, services] = await Promise.all([
        tx.professionalTitle.count({
          where: { id: { in: input.titleIds }, active: true },
        }),
        tx.service.count({
          where: { id: { in: input.serviceIds }, active: true },
        }),
      ]);
      if (
        titles !== new Set(input.titleIds).size ||
        services !== new Set(input.serviceIds).size
      ) {
        throw new DomainError(
          "NOT_FOUND",
          "Algún título o servicio no existe o está inactivo.",
        );
      }

      const removed = current.services
        .map((service) => service.id)
        .filter((id) => !input.serviceIds.includes(id));
      if (removed.length) {
        const appointments = await tx.appointment.findMany({
          where: {
            professionalId: input.id,
            serviceId: { in: removed },
            status: AppointmentStatus.SCHEDULED,
            startsAt: { gt: new Date() },
          },
          select: {
            id: true,
            startsAt: true,
            service: { select: { name: true } },
          },
          orderBy: { startsAt: "asc" },
        });
        if (appointments.length) {
          throw new DomainError(
            "FUTURE_APPOINTMENTS",
            `No se pueden quitar servicios con turnos programados: ${appointments.map((appointment) => `#${appointment.id} ${appointment.service.name} (${appointment.startsAt.toLocaleDateString("es-AR")})`).join(", ")}.`,
          );
        }
      }

      const before = {
        firstName: current.firstName,
        lastName: current.lastName,
        documentType: current.documentType,
        documentNumber: current.documentNumber,
        licenseNumber: current.licenseNumber,
        phone: current.phone,
        email: current.email,
        photoUrl: current.photoUrl,
        notes: current.notes,
        titleIds: current.titles.map((title) => title.id),
        serviceIds: current.services.map((service) => service.id),
      };
      const updated = await tx.professional.update({
        where: { id: input.id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          documentType: input.documentType,
          documentNumber: input.documentNumber,
          licenseNumber: input.licenseNumber,
          phone: input.phone ?? null,
          email: input.email ?? null,
          photoUrl: input.photoUrl ?? null,
          notes: input.notes ?? null,
          titles: { set: input.titleIds.map((id) => ({ id })) },
          services: { set: input.serviceIds.map((id) => ({ id })) },
          updatedById: actor.id,
        },
        select: { id: true, firstName: true, lastName: true },
      });
      await tx.professionalEvent.create({
        data: {
          professionalId: input.id,
          type: ProfessionalEventType.UPDATED,
          reason: input.reason,
          userId: actor.id,
          changes: { before, after: { ...input, reason: undefined } },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function deactivateProfessional(
  input: { id: number; reason: string; deactivatedAt: string },
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  return prisma.$transaction(
    async (tx) => {
      const current = await tx.professional.findUnique({
        where: { id: input.id },
        select: { id: true, active: true },
      });
      if (!current)
        throw new DomainError("NOT_FOUND", "El profesional no existe.");
      if (!current.active)
        throw new DomainError(
          "INVALID_STATUS_TRANSITION",
          "El profesional ya está inactivo.",
        );
      const count = await tx.appointment.count({
        where: {
          professionalId: input.id,
          status: AppointmentStatus.SCHEDULED,
          startsAt: { gt: new Date() },
        },
      });
      if (count)
        throw new DomainError(
          "FUTURE_APPOINTMENTS",
          `El profesional tiene ${count} turno(s) programado(s). Cancelalos antes de darlo de baja.`,
        );
      const date = new Date(`${input.deactivatedAt}T12:00:00.000Z`);
      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== input.deactivatedAt ||
        input.deactivatedAt > new Date().toISOString().slice(0, 10)
      )
        throw new DomainError("VALIDATION", "La fecha de baja no es válida.");
      const updated = await tx.professional.update({
        where: { id: input.id },
        data: {
          active: false,
          deactivatedAt: date,
          deactivationReason: input.reason,
          deactivatedById: actor.id,
          updatedById: actor.id,
        },
        select: { id: true, active: true },
      });
      await tx.professionalEvent.create({
        data: {
          professionalId: input.id,
          type: ProfessionalEventType.DEACTIVATED,
          reason: input.reason,
          userId: actor.id,
          changes: { deactivatedAt: input.deactivatedAt },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function reactivateProfessional(
  input: { id: number; reason: string },
  actor: Actor,
) {
  assertRole(actor, Role.MANAGER);
  return prisma.$transaction(
    async (tx) => {
      const current = await tx.professional.findUnique({
        where: { id: input.id },
        select: { id: true, active: true },
      });
      if (!current)
        throw new DomainError("NOT_FOUND", "El profesional no existe.");
      if (current.active)
        throw new DomainError(
          "INVALID_STATUS_TRANSITION",
          "El profesional ya está activo.",
        );
      const updated = await tx.professional.update({
        where: { id: input.id },
        data: {
          active: true,
          deactivatedAt: null,
          deactivationReason: null,
          deactivatedById: null,
          updatedById: actor.id,
        },
        select: { id: true, active: true },
      });
      await tx.professionalEvent.create({
        data: {
          professionalId: input.id,
          type: ProfessionalEventType.REACTIVATED,
          reason: input.reason,
          userId: actor.id,
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

// ─────────────────────── Funciones de lectura ──────────────────────────

/**
 * Devuelve el listado de profesionales para las pantallas del centro.
 *
 * Es una lectura: la consume un Server Component llamando directo a la DAL
 * (ADR 0001). Devuelve la ficha resumida con títulos y servicios asociados.
 */
export interface ProfessionalFilters {
  query?: string;
  serviceId?: number;
  status?: "active" | "inactive" | "all";
}

export async function listProfessionals(
  filters: ProfessionalFilters,
  actor: Actor,
) {
  assertRole(actor, ...STAFF_ROLES);

  const query = filters.query?.trim();
  if (query && query.length < 2) return [];

  return prisma.professional.findMany({
    where: {
      active:
        filters.status === "active"
          ? true
          : filters.status === "inactive"
            ? false
            : undefined,
      services: filters.serviceId
        ? { some: { id: filters.serviceId } }
        : undefined,
      OR: query
        ? [
            { lastName: { contains: query, mode: "insensitive" } },
            { firstName: { contains: query, mode: "insensitive" } },
            { documentNumber: { contains: query, mode: "insensitive" } },
            { licenseNumber: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      lastName: true,
      firstName: true,
      documentType: true,
      documentNumber: true,
      licenseNumber: true,
      phone: true,
      email: true,
      active: true,
      titles: {
        select: { id: true, name: true },
      },
      services: {
        select: { id: true, name: true, durationMinutes: true },
      },
    },
  });
}

/**
 * Devuelve los títulos profesionales activos para las opciones de formulario.
 */
export async function listActiveProfessionalTitles(actor: Actor) {
  assertRole(actor, ...STAFF_ROLES);

  return prisma.professionalTitle.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Devuelve el catálogo de servicios activos para las opciones de formulario.
 */
export async function listActiveServices(actor: Actor) {
  assertRole(actor, ...STAFF_ROLES);

  return prisma.service.findMany({
    where: { active: true },
    select: { id: true, name: true, durationMinutes: true },
    orderBy: { name: "asc" },
  });
}
