import type { Metadata } from "next";
import { requirePageRole } from "@/lib/dal/auth";
import {
  listActiveProfessionalTitles,
  listActiveServices,
} from "@/lib/dal/professionals";
import { ProfessionalForm } from "./professional-form";

export const metadata: Metadata = {
  title: "Nuevo profesional · Goat",
  description: "Registrar un nuevo profesional en el centro de traumatología.",
};

export default async function NewProfessionalPage() {
  // Solo MANAGER puede acceder a registrar profesionales (HU-02)
  const actor = await requirePageRole("MANAGER");

  // Cargar catálogos activos desde la DAL (ADR 0001)
  const [titles, services] = await Promise.all([
    listActiveProfessionalTitles(actor),
    listActiveServices(actor),
  ]);

  return <ProfessionalForm titles={titles} services={services} />;
}
