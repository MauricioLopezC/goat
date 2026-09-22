import "server-only";

import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/actions";
import { Role, type DocumentType } from "@/generated/prisma/enums";
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

// ─────────────────────── Funciones de lectura ──────────────────────────

/**
 * Devuelve el listado de profesionales para las pantallas del centro.
 *
 * Es una lectura: la consume un Server Component llamando directo a la DAL
 * (ADR 0001). Devuelve la ficha resumida con títulos y servicios asociados.
 */
export async function listProfessionals(actor: Actor) {
  assertRole(actor, ...STAFF_ROLES);

  return prisma.professional.findMany({
    orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
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
