import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  KeyRound,
  LogOut,
  Users,
} from "lucide-react";
import logo from "@/assets/logo-goat.png";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/dal/auth";
import { signOut } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePageRole(Role.PATIENT);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-card print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="flex items-center gap-3">
              <Image
                src={logo}
                width={36}
                height={36}
                alt="GOAT"
                className="size-9 shrink-0 rounded-xl"
                loading="eager"
              />
              <div className="flex flex-col">
                <span className="text-title-md font-semibold leading-tight text-foreground">
                  Portal del Paciente
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  GOAT · Atención Traumatológica
                </span>
              </div>
            </Link>

            {!actor.mustChangePassword && (
              <nav className="hidden md:flex items-center gap-1">
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <Link href="/portal">
                    <CalendarDays className="size-4" />
                    Mis turnos
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <Link href="/portal/appointments/new">
                    <CalendarPlus className="size-4" />
                    Sacar turno
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <Link href="/profesionales">
                    <Users className="size-4" />
                    Profesionales
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <Link href="/portal/change-password">
                    <KeyRound className="size-4" />
                    Cambiar contraseña
                  </Link>
                </Button>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-body-sm font-medium text-foreground">
                {actor.firstName} {actor.lastName}
              </span>
              <span className="text-label-sm text-muted-foreground uppercase">
                Paciente
              </span>
            </div>

            {!actor.mustChangePassword && (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  title="Sacar turno"
                >
                  <Link href="/portal/appointments/new">
                    <CalendarPlus className="size-4" />
                    <span className="sr-only">Sacar turno</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  title="Profesionales del centro"
                >
                  <Link href="/profesionales">
                    <Users className="size-4" />
                    <span className="sr-only">Profesionales del centro</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  title="Cambiar contraseña"
                >
                  <Link href="/portal/change-password">
                    <KeyRound className="size-4" />
                    <span className="sr-only">Cambiar contraseña</span>
                  </Link>
                </Button>
              </>
            )}

            <form action={signOut}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <LogOut className="size-4" />
                <span>Salir</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
