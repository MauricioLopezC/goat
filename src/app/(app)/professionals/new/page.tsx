import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/dal/auth";
import { ProfessionalForm } from "./professional-form";

export const metadata = {
  title: "Nuevo Profesional — Goat",
  description: "Registrar un nuevo profesional en el centro de traumatología.",
};

export default async function NewProfessionalPage() {
  // Solo MANAGER puede acceder a registrar profesionales (HU-02)
  await requirePageRole("MANAGER");

  // Cargar catálogos activos para las opciones del formulario
  const [titles, services] = await Promise.all([
    prisma.professionalTitle.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { active: true },
      select: { id: true, name: true, durationMinutes: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <ProfessionalForm titles={titles} services={services} />;
}
