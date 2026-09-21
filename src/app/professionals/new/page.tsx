import { prisma } from "@/lib/prisma";
import { ProfessionalForm } from "./professional-form";

export const metadata = {
  title: "Nuevo Profesional — Goat",
  description: "Registrar un nuevo profesional en el centro de traumatología.",
};

export default async function NewProfessionalPage() {
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Barra superior de navegación */}
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-xs">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-title-md text-primary-foreground font-semibold">
              G
            </span>
            <div className="flex flex-col">
              <span className="text-title-md font-bold leading-tight">
                Goat
              </span>
              <span className="text-[11px] text-muted-foreground leading-none">
                Gestión Ortopédica y Traumatológica
              </span>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg border border-primary-soft-border bg-primary-soft text-primary-soft-foreground font-medium">
            Rol: Gerente (MANAGER)
          </span>
        </div>
      </header>

      {/* Contenido principal con el formulario */}
      <main className="flex-1 py-8 px-4 md:px-6 lg:px-8">
        <ProfessionalForm titles={titles} services={services} />
      </main>
    </div>
  );
}
