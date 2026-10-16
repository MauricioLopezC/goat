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

  const isLic = professional.titles.some((t) =>
    t.name.toLowerCase().includes("licencia"),
  );
  const prefix = isLic ? "Lic." : "Dr.";
  const displayName = `${prefix} ${professional.lastName}, ${professional.firstName}`;
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
      aria-label={`Ficha de ${displayName}`}
    >
      {/* Contenedor de la foto tipo retrato */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-tray">
        {professional.photoUrl ? (
          <Image
            src={professional.photoUrl}
            alt={displayName}
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

      {/* Pie interactivo con efecto 3D flip al posar el mouse. Fondo siempre oscuro para garantizar contraste */}
      <div className="relative h-24 w-full bg-slate-900 [perspective:1000px]">
        <div
          className={`relative size-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* Frente: Nombre del profesional y título principal */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 px-3 py-2 text-center text-white [backface-visibility:hidden] [-webkit-backface-visibility:hidden]">
            <p className="text-title-md font-bold tracking-tight text-white">
              {displayName}
            </p>
            {titlesText && (
              <p className="text-label-sm text-slate-300 line-clamp-1 mt-1 font-medium">
                {titlesText}
              </p>
            )}
          </div>

          {/* Dorso (reverso visible al girar): Matrícula y Especialidad */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 px-3 py-1.5 text-center text-white [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-body-sm font-bold text-white leading-tight">
              {displayName}
            </p>
            {titlesText && (
              <p className="text-label-sm text-sky-300 line-clamp-1 mt-0.5">
                {titlesText}
              </p>
            )}
            {specialtiesText && (
              <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5 flex items-center justify-center gap-1">
                <Stethoscope className="size-3 shrink-0 text-sky-400" />
                <span>{specialtiesText}</span>
              </p>
            )}
            <div className="mt-1 flex items-center gap-1 rounded bg-amber-400/15 px-2 py-0.5 font-mono text-label-sm font-bold text-amber-300 border border-amber-400/30">
              <IdCard className="size-3.5 shrink-0" />
              <span>M.P. {professional.licenseNumber}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
