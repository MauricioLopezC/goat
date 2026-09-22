"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseMedical,
  Check,
  CheckCircle2,
  Clock,
  FileBadge2,
  IdCard,
  Loader2,
  PlusCircle,
  User,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createProfessional } from "../actions";

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

export function ProfessionalForm({ titles, services }: ProfessionalFormProps) {
  const [state, formAction, isPending] = React.useActionState(
    createProfessional,
    null,
  );

  // Estado controlado para preservar TODOS los datos ingresados ante cualquier error
  const [values, setValues] = React.useState({
    lastName: "",
    firstName: "",
    documentType: "DNI",
    documentNumber: "",
    licenseNumber: "",
    phone: "",
    email: "",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  // Estados locales para multiselect interactivo
  const [selectedTitles, setSelectedTitles] = React.useState<number[]>([]);
  const [selectedServices, setSelectedServices] = React.useState<number[]>([]);

  const toggleTitle = (id: number) => {
    setSelectedTitles((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleService = (id: number) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const fieldErrors = state?.ok === false ? state.error.fieldErrors : undefined;

  // Auto-scroll y foco al primer campo con error para que el usuario lo vea inmediatamente
  React.useEffect(() => {
    if (state?.ok === false && state.error.fieldErrors) {
      const firstErrorField = Object.keys(state.error.fieldErrors)[0];
      if (firstErrorField) {
        const el = document.getElementById(firstErrorField);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }
    }
  }, [state]);

  // Chequeo de errores por sección para alertar en la tarjeta correspondiente
  const personalErrors =
    fieldErrors?.lastName ||
    fieldErrors?.firstName ||
    fieldErrors?.documentType ||
    fieldErrors?.documentNumber ||
    fieldErrors?.phone ||
    fieldErrors?.email;

  const licenseErrors = fieldErrors?.licenseNumber || fieldErrors?.titleIds;
  const serviceErrors = fieldErrors?.serviceIds;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Navegación y encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/professionals"
              className="hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="size-4" />
              Profesionales
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">
              Nuevo profesional
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Registrar Profesional
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete los datos del profesional y asigne los servicios que
            prestará en el centro.
          </p>
        </div>
      </div>

      {/* Banner de éxito */}
      {state?.ok === true && (
        <Card className="border-success-soft-border bg-success-soft/50 shadow-sm rounded-2xl overflow-hidden animate-in fade-in-50 duration-300">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-success text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-success-soft-foreground">
                  ¡Profesional registrado con éxito!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Se ha dado de alta a{" "}
                  <span className="font-semibold text-foreground">
                    {state.data.firstName} {state.data.lastName}
                  </span>{" "}
                  en el sistema. El profesional quedó activo y listo para la
                  carga de horarios.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link href="/professionals" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl"
                >
                  Ver listado
                </Button>
              </Link>
              <Button
                size="sm"
                className="w-full sm:w-auto rounded-xl"
                onClick={() => window.location.reload()}
              >
                <PlusCircle className="size-4 mr-1.5" />
                Registrar otro
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner de error general detallado */}
      {state?.ok === false && (
        <Card className="border-destructive-soft-border bg-destructive-soft/70 shadow-sm rounded-2xl overflow-hidden animate-in fade-in-50 duration-300">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-3 text-destructive-soft-foreground">
              <div className="size-8 rounded-xl bg-destructive text-white flex items-center justify-center shrink-0">
                <AlertCircle className="size-5 stroke-[2.5]" />
              </div>
              <div>
                <p className="text-sm font-bold text-destructive">
                  {state.error.message}
                </p>
                <p className="text-xs text-muted-foreground">
                  Por favor revise y corrija los campos marcados en rojo a
                  continuación:
                </p>
              </div>
            </div>

            {/* Lista explícita de campos que fallaron */}
            {fieldErrors && Object.keys(fieldErrors).length > 0 && (
              <ul className="text-xs text-destructive pl-11 space-y-1 list-disc">
                {Object.entries(fieldErrors).map(([field, msgs]) => (
                  <li key={field}>
                    <span className="font-semibold uppercase">{field}:</span>{" "}
                    {msgs.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Formulario principal */}
      <form action={formAction} className="space-y-6">
        {/* Hidden inputs para sincronizar los arreglos seleccionados */}
        {selectedTitles.map((id) => (
          <input key={`title-${id}`} type="hidden" name="titleIds" value={id} />
        ))}
        {selectedServices.map((id) => (
          <input
            key={`service-${id}`}
            type="hidden"
            name="serviceIds"
            value={id}
          />
        ))}

        {/* 1. Datos Personales */}
        <Card
          className={`shadow-sm rounded-2xl bg-card overflow-hidden transition-all ${
            personalErrors
              ? "border-destructive/60 ring-2 ring-destructive/15"
              : "border-border"
          }`}
        >
          <CardHeader className="bg-tray/40 border-b border-border/60 px-6 py-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-soft text-primary">
                <User className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Información Personal
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Datos de filiación e identificación oficial del profesional
                </CardDescription>
              </div>
            </div>
            {personalErrors && (
              <Badge
                variant="destructive"
                className="rounded-lg text-[11px] gap-1 px-2.5 py-1"
              >
                <AlertCircle className="size-3" />
                Errores en esta sección
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="lastName"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Apellido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                name="lastName"
                value={values.lastName}
                onChange={handleChange}
                placeholder="Ej. Gómez"
                required
                className={`rounded-xl bg-background ${
                  fieldErrors?.lastName
                    ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus-visible:border-destructive"
                    : "border-input"
                }`}
                aria-invalid={!!fieldErrors?.lastName}
              />
              {fieldErrors?.lastName && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.lastName[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="firstName"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                name="firstName"
                value={values.firstName}
                onChange={handleChange}
                placeholder="Ej. Martín Lucas"
                required
                className={`rounded-xl bg-background ${
                  fieldErrors?.firstName
                    ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus-visible:border-destructive"
                    : "border-input"
                }`}
                aria-invalid={!!fieldErrors?.firstName}
              />
              {fieldErrors?.firstName && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.firstName[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="documentType"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Tipo de documento <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <select
                  id="documentType"
                  name="documentType"
                  value={values.documentType}
                  onChange={handleChange}
                  required
                  className={`h-9.5 w-full rounded-xl bg-background px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 appearance-none cursor-pointer ${
                    fieldErrors?.documentType
                      ? "border border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive"
                      : "border border-input focus-visible:border-primary focus-visible:ring-primary/20"
                  }`}
                >
                  <option value="DNI">
                    DNI — Documento Nacional de Identidad
                  </option>
                  <option value="LC">LC — Libreta Cívica</option>
                  <option value="LE">LE — Libreta de Enrolamiento</option>
                  <option value="CI">CI — Cédula de Identidad</option>
                  <option value="PASSPORT">Pasaporte</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                  ▾
                </div>
              </div>
              {fieldErrors?.documentType && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.documentType[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="documentNumber"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Número de documento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="documentNumber"
                name="documentNumber"
                value={values.documentNumber}
                onChange={handleChange}
                placeholder="Ej. 35894120"
                required
                className={`rounded-xl bg-background font-mono ${
                  fieldErrors?.documentNumber
                    ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus-visible:border-destructive"
                    : "border-input"
                }`}
                aria-invalid={!!fieldErrors?.documentNumber}
              />
              {fieldErrors?.documentNumber && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.documentNumber[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="phone"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Teléfono de contacto{" "}
                <span className="text-muted-foreground font-normal lowercase">
                  (opcional)
                </span>
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={values.phone}
                onChange={handleChange}
                placeholder="Ej. +54 9 387 555-1234"
                className={`rounded-xl bg-background ${
                  fieldErrors?.phone
                    ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus-visible:border-destructive"
                    : "border-input"
                }`}
              />
              {fieldErrors?.phone && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.phone[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Correo electrónico{" "}
                <span className="text-muted-foreground font-normal lowercase">
                  (opcional)
                </span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                placeholder="profesional@ejemplo.com"
                className={`rounded-xl bg-background ${
                  fieldErrors?.email
                    ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus-visible:border-destructive"
                    : "border-input"
                }`}
                aria-invalid={!!fieldErrors?.email}
              />
              {fieldErrors?.email && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.email[0]}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Matrícula y Títulos Profesionales */}
        <Card
          className={`shadow-sm rounded-2xl bg-card overflow-hidden transition-all ${
            licenseErrors
              ? "border-destructive/60 ring-2 ring-destructive/15"
              : "border-border"
          }`}
        >
          <CardHeader className="bg-tray/40 border-b border-border/60 px-6 py-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-info-soft text-info">
                <FileBadge2 className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Matrícula y Título de Profesión
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Acreditación profesional requerida por el centro
                </CardDescription>
              </div>
            </div>
            {licenseErrors && (
              <Badge
                variant="destructive"
                className="rounded-lg text-[11px] gap-1 px-2.5 py-1"
              >
                <AlertCircle className="size-3" />
                Errores en esta sección
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="max-w-md space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="licenseNumber"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Matrícula Profesional{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  1 a 8 dígitos numéricos
                </span>
              </div>
              <div className="relative">
                <Input
                  id="licenseNumber"
                  name="licenseNumber"
                  value={values.licenseNumber}
                  onChange={handleChange}
                  placeholder="Ej. 12345"
                  required
                  maxLength={8}
                  className={`rounded-xl bg-background font-mono font-medium pl-9 ${
                    fieldErrors?.licenseNumber
                      ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus-visible:border-destructive text-destructive font-bold"
                      : "border-input"
                  }`}
                  aria-invalid={!!fieldErrors?.licenseNumber}
                />
                <IdCard
                  className={`size-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    fieldErrors?.licenseNumber
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                />
              </div>
              {fieldErrors?.licenseNumber && (
                <p className="text-xs font-semibold text-destructive flex items-center gap-1.5 mt-1 animate-in fade-in-50">
                  <AlertCircle className="size-4 shrink-0" />
                  {fieldErrors.licenseNumber[0]}
                </p>
              )}
            </div>

            {/* Selección de títulos */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Título profesional <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  Puede seleccionar más de una opción
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {titles.map((title) => {
                  const isSelected = selectedTitles.includes(title.id);
                  return (
                    <button
                      type="button"
                      key={title.id}
                      onClick={() => toggleTitle(title.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border-primary bg-primary-soft/40 text-primary-soft-foreground shadow-xs ring-2 ring-primary/20"
                          : "border-border hover:border-border-strong bg-background text-foreground hover:bg-tray/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`size-5 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-primary text-white"
                              : "border border-muted-foreground/30 bg-background"
                          }`}
                        >
                          {isSelected && (
                            <Check className="size-3.5 stroke-[2.5]" />
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {title.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {fieldErrors?.titleIds && (
                <p className="text-xs font-semibold text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.titleIds[0]}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Servicios del Catálogo */}
        <Card
          className={`shadow-sm rounded-2xl bg-card overflow-hidden transition-all ${
            serviceErrors
              ? "border-destructive/60 ring-2 ring-destructive/15"
              : "border-border"
          }`}
        >
          <CardHeader className="bg-tray/40 border-b border-border/60 px-6 py-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-success-soft text-success">
                <BriefcaseMedical className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Prestaciones y Servicios Habilitados
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Seleccione al menos un servicio del catálogo que el
                  profesional atenderá
                </CardDescription>
              </div>
            </div>
            {serviceErrors && (
              <Badge
                variant="destructive"
                className="rounded-lg text-[11px] gap-1 px-2.5 py-1"
              >
                <AlertCircle className="size-3" />
                Seleccione al menos uno
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-primary bg-primary-soft/40 text-primary-soft-foreground shadow-xs ring-2 ring-primary/20"
                        : "border-border hover:border-border-strong bg-background text-foreground hover:bg-tray/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-5 rounded-lg mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-primary text-white"
                            : "border border-muted-foreground/30 bg-background"
                        }`}
                      >
                        {isSelected && (
                          <Check className="size-3.5 stroke-[2.5]" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-sm font-semibold block">
                          {service.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="size-3.5" />
                          <span>
                            {service.durationMinutes} minutos por turno
                          </span>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Badge
                        variant="default"
                        className="rounded-lg bg-primary text-white text-[11px] h-5 px-2"
                      >
                        Habilitado
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
            {fieldErrors?.serviceIds && (
              <p className="text-xs font-semibold text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="size-3.5" />
                {fieldErrors.serviceIds[0]}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 4. Observaciones adicionales */}
        <Card className="shadow-sm rounded-2xl border-border bg-card overflow-hidden">
          <CardContent className="p-6 space-y-1.5">
            <Label
              htmlFor="notes"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Observaciones internas{" "}
              <span className="text-muted-foreground font-normal lowercase">
                (opcional)
              </span>
            </Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={values.notes}
              onChange={handleChange}
              placeholder="Notas administrativas o aclaraciones sobre la disponibilidad o perfil del profesional..."
              className="w-full rounded-xl border border-input bg-background p-3 text-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
            />
          </CardContent>
        </Card>

        {/* Acciones del formulario */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <Link href="/professionals" className="w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto rounded-xl px-6"
            >
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full sm:w-auto rounded-xl px-8 bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-medium shadow-sm transition-all"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Registrando...
              </>
            ) : (
              <>
                <UserCheck className="size-4 mr-2" />
                Guardar profesional
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
