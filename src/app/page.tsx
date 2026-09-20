import { CalendarDays, ClipboardList, Stethoscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const modules = [
  {
    icon: Users,
    title: "Pacientes",
    description: "Datos personales y cobertura de cada paciente.",
  },
  {
    icon: Stethoscope,
    title: "Profesionales",
    description: "Matrícula, prestaciones y franjas de atención.",
  },
  {
    icon: ClipboardList,
    title: "Turnos",
    description: "Asignar, reprogramar y cancelar con trazabilidad.",
  },
  {
    icon: CalendarDays,
    title: "Calendario",
    description: "La agenda del centro por día, semana o mes.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 md:px-6 lg:px-8">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-title-md text-primary-foreground">
            G
          </span>
          <span className="text-title-lg">Goat</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-12 md:px-6 md:py-16 lg:px-8">
        <section className="flex flex-col items-start gap-5">
          <span className="inline-flex items-center rounded-lg border border-info-soft-border bg-info-soft px-2 py-1 text-label-sm uppercase text-info-soft-foreground">
            Incremento 1 · En desarrollo
          </span>
          <h1 className="text-headline-lg sm:text-display-lg">
            Bienvenido a Goat
          </h1>
          <p className="max-w-2xl text-body-lg text-muted-foreground">
            Gestión de turnos y atención ambulatoria para un policonsultorio de
            traumatología. Esta es una página de bienvenida provisoria: acá va a
            vivir el panel principal del centro.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg">
              <CalendarDays data-icon="inline-start" />
              Ver agenda
            </Button>
            <Button size="lg" variant="outline">
              <Users data-icon="inline-start" />
              Registrar paciente
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="modules-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="modules-heading"
            className="text-label-md uppercase text-muted-foreground"
          >
            Qué vas a poder hacer
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ icon: Icon, title, description }) => (
              <li
                key={title}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <span className="flex size-9 items-center justify-center rounded-lg border border-primary-soft-border bg-primary-soft text-primary-soft-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-title-md">{title}</h3>
                  <p className="text-body-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
