import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LogIn, Phone, Stethoscope, Users } from "lucide-react";

import logo from "@/assets/logo-goat.png";
import { listPublicProfessionals } from "@/lib/dal/professionals";
import { Button } from "@/components/ui/button";
import { ProfessionalVitaeCard } from "@/components/professionals/professional-vitae-card";

export const metadata: Metadata = {
  title: "Cuerpo Médico · GOAT",
  description:
    "Conocé a los especialistas y profesionales del policonsultorio de traumatología GOAT.",
};

export default async function PublicProfessionalsPage() {
  const professionals = await listPublicProfessionals();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Barra de navegación pública institucional */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <Link href="/profesionales" className="flex items-center gap-3">
            <Image
              src={logo}
              width={36}
              height={36}
              alt="GOAT"
              className="size-9 shrink-0 rounded-xl"
              priority
            />
            <div className="flex flex-col">
              <span className="text-title-md font-bold leading-tight text-foreground">
                GOAT
              </span>
              <span className="text-xs text-muted-foreground">
                Traumatología y Ortopedia
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex gap-1.5"
            >
              <Link href="/login">
                <LogIn className="size-4" />
                Ingreso al sistema
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
        {/* Cabecera de la sección estilo Vitae */}
        <div className="flex flex-col gap-3 border-b-2 border-primary/20 pb-6">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Stethoscope className="size-4" />
            <span>Equipo de atención ambulatoria</span>
          </div>
          <h1 className="text-display-lg font-bold tracking-tight text-foreground sm:text-4xl">
            Profesionales
          </h1>
          <p className="max-w-2xl text-body-lg text-muted-foreground">
            Cuerpo médico, traumatólogos, kinesiólogos y especialistas
            habilitados para la atención y tratamiento en nuestro centro.
          </p>
        </div>

        {/* Grilla interactiva de profesionales */}
        {professionals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Users className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-title-md font-semibold text-foreground">
                No hay profesionales cargados
              </h2>
              <p className="text-body-sm text-muted-foreground">
                El equipo médico se encuentra en actualización.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {professionals.map((prof) => (
              <ProfessionalVitaeCard key={prof.id} professional={prof} />
            ))}
          </div>
        )}
      </main>

      {/* Pie de página institucional */}
      <footer className="border-t border-border bg-card py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            © {new Date().getFullYear()} GOAT · Policonsultorio de
            Traumatología.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Phone className="size-3" /> Atención ambulatoria
            </span>
            <Link href="/login" className="hover:underline">
              Acceso profesional y administrativo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
