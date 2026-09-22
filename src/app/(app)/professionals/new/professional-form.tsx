"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseMedical,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileBadge2,
  List,
  PlusCircle,
  User,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProfessional, type CreateProfessionalState } from "../actions";

interface TitleOption {
  id: number;
  name: string;
}

interface ServiceOption {
  id: number;
  name: string;
  durationMinutes: number;
}

interface ProfessionalFormProps {
  titles: TitleOption[];
  services: ServiceOption[];
}

const DOCUMENT_TYPES = [
  { value: "DNI", label: "DNI — Documento Nacional de Identidad" },
  { value: "LC", label: "LC — Libreta Cívica" },
  { value: "LE", label: "LE — Libreta de Enrolamiento" },
  { value: "CI", label: "CI — Cédula de Identidad" },
  { value: "PASSPORT", label: "Pasaporte" },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <UserCheck className="size-4 mr-2" />
      {pending ? "Guardando…" : "Guardar profesional"}
    </Button>
  );
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-body-sm text-destructive">
      {errors[0]}
    </p>
  );
}

export function ProfessionalForm({ titles, services }: ProfessionalFormProps) {
  const [state, formAction] = useActionState<CreateProfessionalState, FormData>(
    createProfessional,
    null,
  );

  const created = state?.ok ? state.data : undefined;
  const failed = state?.ok === false ? state.error : undefined;
  const fields = failed?.fieldErrors;

  // Valores restaurados ante fallo de validación
  const values = state?.values;

  // Remontar los campos en cada intento para que defaultValue se aplique
  const attempt = state ? (created ? "ok" : "error") : "inicial";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Cabecera de la vista */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/professionals">
            <ArrowLeft className="size-4 mr-1.5" />
            Volver al listado
          </Link>
        </Button>
        <div>
          <h1 className="text-headline-lg font-bold text-foreground">
            Alta de profesional
          </h1>
          <p className="text-body-sm text-muted-foreground">
            Registrar un nuevo miembro del cuerpo médico con su matrícula y
            servicios asignados (HU-02).
          </p>
        </div>
      </div>

      {/* Banner de éxito (HU-02) */}
      {created && (
        <Alert
          role="status"
          className="border-success-soft-border bg-success-soft text-success-soft-foreground"
        >
          <CheckCircle2 className="size-5 text-success" />
          <AlertDescription className="space-y-3">
            <p className="text-body-md text-foreground">
              Se dio de alta con éxito a{" "}
              <strong className="font-semibold text-foreground">
                {created.firstName} {created.lastName}
              </strong>
              . El profesional quedó registrado y activo en el sistema.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button asChild size="sm">
                <Link href={`/professionals/${created.id}/schedules`}>
                  <CalendarPlus className="size-4 mr-1.5" />
                  Cargar horarios de atención
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/professionals">
                  <List className="size-4 mr-1.5" />
                  Ver listado
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/professionals/new">
                  <PlusCircle className="size-4 mr-1.5" />
                  Registrar otro
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Banner de error general */}
      {failed && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-5" />
          <AlertDescription>
            <p className="font-semibold">{failed.message}</p>
            {fields && Object.keys(fields).length > 0 && (
              <ul className="list-disc pl-5 mt-1.5 text-body-sm space-y-0.5">
                {Object.entries(fields).map(([field, msgs]) => (
                  <li key={field}>
                    <span className="font-medium uppercase">{field}:</span>{" "}
                    {msgs.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Formulario principal */}
      <form action={formAction} className="flex flex-col gap-6">
        <div key={attempt} className="flex flex-col gap-6">
          {/* 1. Datos Personales */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="size-5 text-primary" />
                <CardTitle className="text-title-lg">
                  Información personal
                </CardTitle>
              </div>
              <CardDescription>
                Identificación y filiación del profesional en el centro.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={values?.firstName ?? ""}
                  placeholder="Ej. Martín"
                  required
                  aria-invalid={Boolean(fields?.firstName)}
                  aria-describedby={
                    fields?.firstName ? "firstName-error" : undefined
                  }
                />
                <FieldError id="firstName-error" errors={fields?.firstName} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="lastName">
                  Apellido <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={values?.lastName ?? ""}
                  placeholder="Ej. González"
                  required
                  aria-invalid={Boolean(fields?.lastName)}
                  aria-describedby={
                    fields?.lastName ? "lastName-error" : undefined
                  }
                />
                <FieldError id="lastName-error" errors={fields?.lastName} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="documentType">
                  Tipo de documento <span className="text-destructive">*</span>
                </Label>
                <Select
                  name="documentType"
                  defaultValue={values?.documentType ?? "DNI"}
                >
                  <SelectTrigger id="documentType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        {dt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError
                  id="documentType-error"
                  errors={fields?.documentType}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="documentNumber">
                  Número de documento{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="documentNumber"
                  name="documentNumber"
                  defaultValue={values?.documentNumber ?? ""}
                  placeholder="Ej. 35894120"
                  required
                  aria-invalid={Boolean(fields?.documentNumber)}
                  aria-describedby={
                    fields?.documentNumber ? "documentNumber-error" : undefined
                  }
                />
                <FieldError
                  id="documentNumber-error"
                  errors={fields?.documentNumber}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Teléfono (opcional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={values?.phone ?? ""}
                  placeholder="Ej. +54 9 387 555-1234"
                  aria-invalid={Boolean(fields?.phone)}
                  aria-describedby={fields?.phone ? "phone-error" : undefined}
                />
                <FieldError id="phone-error" errors={fields?.phone} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email (opcional)</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={values?.email ?? ""}
                  placeholder="profesional@ejemplo.com"
                  aria-invalid={Boolean(fields?.email)}
                  aria-describedby={fields?.email ? "email-error" : undefined}
                />
                <FieldError id="email-error" errors={fields?.email} />
              </div>
            </CardContent>
          </Card>

          {/* 2. Ejercicio Profesional */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileBadge2 className="size-5 text-primary" />
                <CardTitle className="text-title-lg">
                  Ejercicio profesional
                </CardTitle>
              </div>
              <CardDescription>
                Matrícula habilitante y títulos otorgados por colegios o
                universidades.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 sm:max-w-xs">
                <Label htmlFor="licenseNumber">
                  Matrícula profesional{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="licenseNumber"
                  name="licenseNumber"
                  defaultValue={values?.licenseNumber ?? ""}
                  placeholder="Ej. 12345 (1 a 8 dígitos)"
                  required
                  maxLength={8}
                  aria-invalid={Boolean(fields?.licenseNumber)}
                  aria-describedby={
                    fields?.licenseNumber ? "licenseNumber-error" : undefined
                  }
                />
                <FieldError
                  id="licenseNumber-error"
                  errors={fields?.licenseNumber}
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <Label>
                    Título profesional{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-label-sm text-muted-foreground">
                    Puede seleccionar más de uno
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {titles.map((title) => {
                    const isChecked = values?.titleIds
                      ? values.titleIds.includes(title.id)
                      : false;
                    return (
                      <label
                        key={title.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-tray cursor-pointer select-none transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft/30"
                      >
                        <input
                          type="checkbox"
                          name="titleIds"
                          value={title.id}
                          defaultChecked={isChecked}
                          className="size-4 rounded border-input text-primary focus:ring-primary accent-primary"
                        />
                        <span className="text-body-sm font-medium text-foreground">
                          {title.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <FieldError id="titleIds-error" errors={fields?.titleIds} />
              </div>
            </CardContent>
          </Card>

          {/* 3. Servicios que presta */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BriefcaseMedical className="size-5 text-primary" />
                <CardTitle className="text-title-lg">
                  Servicios y prestaciones
                </CardTitle>
              </div>
              <CardDescription>
                Servicios del catálogo clínico que el profesional queda
                habilitado para brindar.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Label>
                Prestaciones habilitadas{" "}
                <span className="text-destructive">*</span>
              </Label>

              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => {
                  const isChecked = values?.serviceIds
                    ? values.serviceIds.includes(service.id)
                    : false;
                  return (
                    <label
                      key={service.id}
                      className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-card hover:bg-tray cursor-pointer select-none transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft/30"
                    >
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={service.id}
                        defaultChecked={isChecked}
                        className="size-4 mt-0.5 rounded border-input text-primary focus:ring-primary accent-primary"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-body-sm font-medium text-foreground">
                          {service.name}
                        </span>
                        <span className="text-label-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {service.durationMinutes} min por turno
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <FieldError id="serviceIds-error" errors={fields?.serviceIds} />
            </CardContent>
          </Card>

          {/* 4. Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-title-lg">
                Observaciones internas
              </CardTitle>
              <CardDescription>
                Notas administrativas opcionales sobre el profesional o su
                perfil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={values?.notes ?? ""}
                placeholder="Aclaraciones sobre disponibilidad, convenios o perfil médico..."
                className="w-full rounded-lg border border-input bg-card p-3 text-body-sm outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
              <FieldError id="notes-error" errors={fields?.notes} />
            </CardContent>
          </Card>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button asChild variant="outline">
            <Link href="/professionals">Cancelar</Link>
          </Button>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
