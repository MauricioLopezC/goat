"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import type { CreatedPatientSummary } from "@/lib/dal/patients";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  GENDERS,
  GENDER_LABEL,
  COVERAGE_TYPES,
  COVERAGE_TYPE_LABEL,
} from "@/lib/patients";
import { CoverageType, DocumentType, Gender } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createPatient } from "./actions";

type HealthInsurerOption = {
  id: number;
  name: string;
  plans: { id: number; name: string }[];
};

interface NewPatientFormProps {
  healthInsurers: HealthInsurerOption[];
}

type FormState = ActionResult<CreatedPatientSummary> | null;

export function NewPatientForm({ healthInsurers }: NewPatientFormProps) {
  const [coverageType, setCoverageType] = useState<CoverageType>(
    CoverageType.PRIVATE,
  );
  const [selectedInsurerId, setSelectedInsurerId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedGender, setSelectedGender] = useState<string>(Gender.MALE);
  const [selectedDocType, setSelectedDocType] = useState<string>(
    DocumentType.DNI,
  );
  const [keyReset, setKeyReset] = useState<number>(0);

  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const raw = {
        lastName: formData.get("lastName"),
        firstName: formData.get("firstName"),
        gender: formData.get("gender"),
        documentType: formData.get("documentType"),
        documentNumber: formData.get("documentNumber"),
        birthDate: formData.get("birthDate"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        coverageType: formData.get("coverageType"),
        healthInsurerId: formData.get("healthInsurerId"),
        insurancePlanId: formData.get("insurancePlanId"),
        memberNumber: formData.get("memberNumber"),
        copayAmount: formData.get("copayAmount"),
        guardianName: formData.get("guardianName"),
        guardianPhone: formData.get("guardianPhone"),
      };
      return await createPatient(raw);
    },
    null,
  );

  const handleReset = () => {
    setCoverageType(CoverageType.PRIVATE);
    setSelectedInsurerId("");
    setSelectedPlanId("");
    setSelectedGender(Gender.MALE);
    setSelectedDocType(DocumentType.DNI);
    setKeyReset((prev) => prev + 1);
  };

  const selectedInsurer = healthInsurers.find(
    (ins) => String(ins.id) === selectedInsurerId,
  );
  const availablePlans = selectedInsurer ? selectedInsurer.plans : [];

  const fieldErrors =
    state?.ok === false && state.error.code === "VALIDATION"
      ? state.error.fieldErrors
      : undefined;

  const isDuplicate =
    state?.ok === false && state.error.code === "DUPLICATE_PATIENT";
  const duplicateId =
    state?.ok === false
      ? state.error.fieldErrors?.existingPatientId?.[0]
      : undefined;
  const duplicateName =
    state?.ok === false
      ? state.error.fieldErrors?.existingPatientName?.[0]
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Caso de éxito */}
      {state?.ok === true && (
        <Card className="border-success-soft-border bg-success-soft/30">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
            <CheckCircle2 className="size-6 text-success shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-title-lg text-success-soft-foreground">
                Paciente registrado con éxito
              </CardTitle>
              <CardDescription className="text-body-md text-muted-foreground mt-1">
                Se guardó la ficha de{" "}
                <strong className="text-foreground">
                  {state.data.lastName}, {state.data.firstName}
                </strong>{" "}
                con {state.data.documentType}{" "}
                <span className="font-mono tabular-nums font-semibold">
                  {state.data.documentNumber}
                </span>
                . El paciente ya está disponible para recibir turnos y en la
                búsqueda.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              asChild
              size="default"
              className="bg-primary hover:bg-primary-hover"
            >
              <Link href={`/appointments/new?patientId=${state.data.id}`}>
                <CalendarPlus data-icon="inline-start" />
                Dar turno a este paciente
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="bg-card"
            >
              <UserPlus data-icon="inline-start" />
              Registrar otro paciente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Caso de duplicado de documento */}
      {isDuplicate && (
        <Alert
          variant="destructive"
          className="border-warning-soft-border bg-warning-soft/30 text-warning-soft-foreground"
        >
          <AlertCircle className="size-5 text-warning shrink-0" />
          <div className="flex-1">
            <AlertTitle className="text-title-md font-semibold text-warning-soft-foreground">
              Paciente ya registrado
            </AlertTitle>
            <AlertDescription className="text-body-md text-foreground mt-1">
              {state.error.message}
              {duplicateName && (
                <div className="mt-2 text-body-sm">
                  Paciente existente: <strong>{duplicateName}</strong>
                </div>
              )}
            </AlertDescription>
            {duplicateId && (
              <div className="mt-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-warning-soft-border bg-card"
                >
                  <Link href={`/patients/${duplicateId}`}>
                    <ExternalLink data-icon="inline-start" />
                    Abrir paciente existente
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </Alert>
      )}

      {/* Formulario principal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline-sm">Datos del paciente</CardTitle>
          <CardDescription className="text-body-md text-muted-foreground">
            Completá los datos mínimos para registrar al paciente y asignarle un
            turno.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            key={keyReset}
            action={formAction}
            className="flex flex-col gap-6"
          >
            {/* SECCIÓN 1: Identificación y datos personales */}
            <div>
              <h3 className="text-label-sm font-semibold uppercase text-muted-foreground tracking-wider mb-4">
                Identificación y datos personales
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Apellido */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lastName">
                    Apellido <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    required
                    placeholder="Ej. González"
                    aria-invalid={!!fieldErrors?.lastName}
                  />
                  {fieldErrors?.lastName && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.lastName[0]}
                    </p>
                  )}
                </div>

                {/* Nombre */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="firstName">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    required
                    placeholder="Ej. Martín"
                    aria-invalid={!!fieldErrors?.firstName}
                  />
                  {fieldErrors?.firstName && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.firstName[0]}
                    </p>
                  )}
                </div>

                {/* Género */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gender">
                    Género <span className="text-destructive">*</span>
                  </Label>
                  <input type="hidden" name="gender" value={selectedGender} />
                  <Select
                    value={selectedGender}
                    onValueChange={setSelectedGender}
                  >
                    <SelectTrigger id="gender" className="h-9.5 w-full">
                      <SelectValue placeholder="Seleccionar género" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {GENDER_LABEL[gender]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors?.gender && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.gender[0]}
                    </p>
                  )}
                </div>

                {/* Tipo de Documento */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="documentType">
                    Tipo de documento{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <input
                    type="hidden"
                    name="documentType"
                    value={selectedDocType}
                  />
                  <Select
                    value={selectedDocType}
                    onValueChange={setSelectedDocType}
                  >
                    <SelectTrigger id="documentType" className="h-9.5 w-full">
                      <SelectValue placeholder="Tipo de documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {DOCUMENT_TYPE_LABEL[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors?.documentType && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.documentType[0]}
                    </p>
                  )}
                </div>

                {/* Número de Documento */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="documentNumber">
                    Número de documento{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="documentNumber"
                    name="documentNumber"
                    required
                    placeholder="Sin puntos ni espacios"
                    className="font-mono"
                    aria-invalid={!!fieldErrors?.documentNumber || isDuplicate}
                  />
                  {fieldErrors?.documentNumber && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.documentNumber[0]}
                    </p>
                  )}
                </div>

                {/* Fecha de Nacimiento */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="birthDate">
                    Fecha de nacimiento{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    required
                    aria-invalid={!!fieldErrors?.birthDate}
                  />
                  {fieldErrors?.birthDate && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.birthDate[0]}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* SECCIÓN 2: Contacto */}
            <div>
              <h3 className="text-label-sm font-semibold uppercase text-muted-foreground tracking-wider mb-4">
                Información de contacto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Teléfono */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">
                    Teléfono de contacto{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="Ej. 11 4455-6677"
                    aria-invalid={!!fieldErrors?.phone}
                  />
                  {fieldErrors?.phone && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.phone[0]}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">
                    Correo electrónico{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="paciente@ejemplo.com"
                    aria-invalid={!!fieldErrors?.email}
                  />
                  {fieldErrors?.email && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.email[0]}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* SECCIÓN 3: Cobertura médica */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-label-sm font-semibold uppercase text-muted-foreground tracking-wider">
                  Cobertura médica
                </h3>
                <Badge variant="outline" className="text-label-sm">
                  {COVERAGE_TYPE_LABEL[coverageType]}
                </Badge>
              </div>

              {/* Selector de tipo de cobertura */}
              <input type="hidden" name="coverageType" value={coverageType} />
              <div className="flex gap-4 mb-4">
                {COVERAGE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setCoverageType(type);
                      if (type === CoverageType.PRIVATE) {
                        setSelectedInsurerId("");
                        setSelectedPlanId("");
                      }
                    }}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      coverageType === type
                        ? "border-primary bg-primary-soft/20 ring-2 ring-primary/20"
                        : "border-border bg-card hover:bg-tray"
                    }`}
                  >
                    <div className="text-title-md font-medium text-foreground">
                      {COVERAGE_TYPE_LABEL[type]}
                    </div>
                    <div className="text-body-sm text-muted-foreground">
                      {type === CoverageType.PRIVATE
                        ? "Atención particular sin obra social ni prepaga"
                        : "Cobertura mediante obra social o seguro médico"}
                    </div>
                  </button>
                ))}
              </div>

              {/* Campos condicionales para obra social */}
              {coverageType === CoverageType.HEALTH_INSURANCE && (
                <div className="rounded-lg border border-border p-4 bg-tray/40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
                  {/* Obra Social */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="healthInsurerId">
                      Obra social <span className="text-destructive">*</span>
                    </Label>
                    <input
                      type="hidden"
                      name="healthInsurerId"
                      value={selectedInsurerId}
                    />
                    <Select
                      value={selectedInsurerId}
                      onValueChange={(val) => {
                        setSelectedInsurerId(val);
                        setSelectedPlanId("");
                      }}
                    >
                      <SelectTrigger
                        id="healthInsurerId"
                        className="h-9.5 w-full bg-card"
                      >
                        <SelectValue placeholder="Elegir obra social" />
                      </SelectTrigger>
                      <SelectContent>
                        {healthInsurers.map((insurer) => (
                          <SelectItem
                            key={insurer.id}
                            value={String(insurer.id)}
                          >
                            {insurer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors?.healthInsurerId && (
                      <p className="text-body-sm text-destructive">
                        {fieldErrors.healthInsurerId[0]}
                      </p>
                    )}
                  </div>

                  {/* Plan */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="insurancePlanId">
                      Plan <span className="text-destructive">*</span>
                    </Label>
                    <input
                      type="hidden"
                      name="insurancePlanId"
                      value={selectedPlanId}
                    />
                    <Select
                      value={selectedPlanId}
                      onValueChange={setSelectedPlanId}
                      disabled={
                        !selectedInsurerId || availablePlans.length === 0
                      }
                    >
                      <SelectTrigger
                        id="insurancePlanId"
                        className="h-9.5 w-full bg-card"
                      >
                        <SelectValue
                          placeholder={
                            !selectedInsurerId
                              ? "Primero elija obra social"
                              : availablePlans.length === 0
                                ? "Sin planes disponibles"
                                : "Elegir plan"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlans.map((plan) => (
                          <SelectItem key={plan.id} value={String(plan.id)}>
                            {plan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors?.insurancePlanId && (
                      <p className="text-body-sm text-destructive">
                        {fieldErrors.insurancePlanId[0]}
                      </p>
                    )}
                  </div>

                  {/* Número de afiliado */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="memberNumber">
                      Nº de afiliado <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="memberNumber"
                      name="memberNumber"
                      placeholder="Ej. 12345678/00"
                      className="bg-card font-mono"
                      aria-invalid={!!fieldErrors?.memberNumber}
                    />
                    {fieldErrors?.memberNumber && (
                      <p className="text-body-sm text-destructive">
                        {fieldErrors.memberNumber[0]}
                      </p>
                    )}
                  </div>

                  {/* Coseguro */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="copayAmount">
                      Coseguro ($) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="copayAmount"
                      name="copayAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue="0"
                      placeholder="0.00"
                      className="bg-card tabular-nums"
                      aria-invalid={!!fieldErrors?.copayAmount}
                    />
                    {fieldErrors?.copayAmount && (
                      <p className="text-body-sm text-destructive">
                        {fieldErrors.copayAmount[0]}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* SECCIÓN 4: Responsable o tutor (opcional para menores) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-label-sm font-semibold uppercase text-muted-foreground tracking-wider">
                  Responsable o tutor (opcional)
                </h3>
                <span className="text-body-sm text-muted-foreground">
                  Para menores de edad o pacientes a cargo
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre del tutor */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="guardianName">
                    Nombre del responsable o tutor
                  </Label>
                  <Input
                    id="guardianName"
                    name="guardianName"
                    placeholder="Ej. Laura González (Madre)"
                    aria-invalid={!!fieldErrors?.guardianName}
                  />
                  {fieldErrors?.guardianName && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.guardianName[0]}
                    </p>
                  )}
                </div>

                {/* Teléfono del tutor */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="guardianPhone">
                    Teléfono del responsable
                  </Label>
                  <Input
                    id="guardianPhone"
                    name="guardianPhone"
                    type="tel"
                    placeholder="Ej. 11 8899-0011"
                    aria-invalid={!!fieldErrors?.guardianPhone}
                  />
                  {fieldErrors?.guardianPhone && (
                    <p className="text-body-sm text-destructive">
                      {fieldErrors.guardianPhone[0]}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button asChild variant="outline">
                <Link href="/calendar">Cancelar</Link>
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary-hover"
              >
                {isPending ? "Guardando..." : "Registrar paciente"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
