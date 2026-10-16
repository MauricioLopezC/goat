"use client";

import { useState } from "react";
import Image from "next/image";
import { IdCard, Stethoscope, User } from "lucide-react";
import type { PublicProfessionalItem } from "@/lib/dal/professionals";

interface ProfessionalVitaeCardProps {
  professional: PublicProfessionalItem;
}

export function ProfessionalVitaeCard({
  professional,
}: ProfessionalVitaeCardProps) {
  const [flipped, setFlipped] = useState(false);

  const fullName = `${professional.firstName} ${professional.lastName}`;
  const titlesText = professional.titles.map((t) => t.name).join(", ");
  const specialtiesText = Array.from(
    new Set(
      professional.services
        .map((s) => s.specialty?.name || s.name)
        .filter(Boolean),
    ),
  ).join(" · ");

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all duration-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      tabIndex={0}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={() => setFlipped((prev) => !prev)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((prev) => !prev);
        }
      }}
      aria-label={`Ficha de ${fullName}`}
    >
      {/* Contenedor de la foto tipo retrato */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-tray">
        {professional.photoUrl ? (
          <Image
            src={professional.photoUrl}
            alt={fullName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-primary-soft/20 to-tray p-6 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary shadow-xs">
              <User className="size-10" />
            </div>
            <div className="space-y-1">
              <span className="text-display-sm font-bold text-primary">
                {(professional.firstName[0] ?? "") +
                  (professional.lastName[0] ?? "")}
              </span>
              <p className="text-label-sm uppercase tracking-wider text-muted-foreground">
                GOAT Traumatología
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pie interactivo con efecto 3D flip al posar el mouse */}
      <div className="relative h-24 w-full [perspective:1000px]">
        <div
          className={`relative size-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* Frente: Nombre del profesional */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary px-3 py-2 text-center text-primary-foreground [backface-visibility:hidden]">
            <p className="text-title-md font-bold tracking-tight">
              Dr. {professional.lastName}, {professional.firstName}
            </p>
            {titlesText && (
              <p className="text-label-sm text-primary-foreground/80 line-clamp-1 mt-0.5">
                {titlesText}
              </p>
            )}
            <span className="text-[10px] text-primary-foreground/60 mt-1 flex items-center gap-1 font-mono">
              Pasa el mouse para ver matrícula
            </span>
          </div>

          {/* Dorso (reverso visible al girar): Matrícula y Especialidad */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary-hover px-4 py-2 text-center text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-body-sm font-bold leading-tight">{fullName}</p>
            {titlesText && (
              <p className="text-label-sm text-primary-soft line-clamp-1 mt-0.5">
                {titlesText}
              </p>
            )}
            {specialtiesText && (
              <p className="text-[11px] text-white/90 line-clamp-1 mt-0.5 flex items-center gap-1">
                <Stethoscope className="size-3 shrink-0 text-primary-soft" />
                {specialtiesText}
              </p>
            )}
            <div className="mt-1 flex items-center gap-1 font-mono text-label-sm font-semibold text-warning-soft">
              <IdCard className="size-3.5" />
              <span>M.P. {professional.licenseNumber}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
