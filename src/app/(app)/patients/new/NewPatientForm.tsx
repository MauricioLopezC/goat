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
import { cn } from "cn";
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

const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const dniRegex = /^\d{7,8}$/;
const phoneRegex = /^\+?\d{7,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewPatientForm({ healthInsurers }: NewPatientFormProps) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [documentType] = useState<DocumentType>(DocumentType.DNI);
  const [documentNumber, setDocumentNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [coverageType, setCoverageType] = useState<CoverageType>(
    CoverageType.PRIVATE,
  );
  const [healthInsurerId, setHealthInsurerId] = useState("");
  const [insurancePlanId, setInsurancePlanId] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [copayAmount, setCopayAmount] = useState("0");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
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

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleReset = () => {
    setLastName("");
    setFirstName("");
    setGender(Gender.MALE);
    setDocumentNumber("");
    setBirthDate("");
    setPhone("");
    setEmail("");
    setCoverageType(CoverageType.PRIVATE);
    setHealthInsurerId("");
    setInsurancePlanId("");
    setMemberNumber("");
    setCopayAmount("0");
    setGuardianName("");
    setGuardianPhone("");
    setTouched({});
    setKeyReset((prev) => prev + 1);
  };

  const selectedInsurer = healthInsurers.find(
    (ins) => String(ins.id) === healthInsurerId,
  );
  const availablePlans = selectedInsurer ? selectedInsurer.plans : [];

  // Validaciones del lado del cliente
  const clientErrors: Record<string, string> = {};

  if (!lastName.trim()) {
    clientErrors.lastName = "El apellido es obligatorio";
  } else if (lastName.trim().length < 2) {
    clientErrors.lastName = "El apellido debe tener al menos 2 caracteres";
  } else if (lastName.trim().length > 60) {
    clientErrors.lastName = "El apellido debe tener como máximo 60 caracteres";
  } else if (!nameRegex.test(lastName.trim())) {
    clientErrors.lastName =
      "Solo se permiten letras, espacios, tildes y apóstrofes";
  }

  if (!firstName.trim()) {
    clientErrors.firstName = "El nombre es obligatorio";
  } else if (firstName.trim().length < 2) {
    clientErrors.firstName = "El nombre debe tener al menos 2 caracteres";
  } else if (firstName.trim().length > 60) {
    clientErrors.firstName = "El nombre debe tener como máximo 60 caracteres";
  } else if (!nameRegex.test(firstName.trim())) {
    clientErrors.firstName =
      "Solo se permiten letras, espacios, tildes y apóstrofes";
  }

  if (!documentNumber.trim()) {
    clientErrors.documentNumber = "El número de documento es obligatorio";
  } else if (!dniRegex.test(documentNumber.trim())) {
    clientErrors.documentNumber =
      "El DNI debe tener exactamente 7 u 8 dígitos numéricos sin puntos ni espacios";
  }

  if (!birthDate) {
    clientErrors.birthDate = "La fecha de nacimiento es obligatoria";
  } else {
    const birth = new Date(`${birthDate}T00:00:00`);
    if (isNaN(birth.getTime())) {
      clientErrors.birthDate = "Fecha inválida";
    } else {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (birth > today) {
        clientErrors.birthDate = "La fecha de nacimiento no puede ser futura";
      } else {
        const minDate = new Date(
          now.getFullYear() - 120,
          now.getMonth(),
          now.getDate(),
        );
        if (birth < minDate) {
          clientErrors.birthDate =
            "La fecha de nacimiento no puede ser anterior a 120 años";
        }
      }
    }
  }

  if (!phone.trim()) {
    clientErrors.phone = "El teléfono es obligatorio";
  } else if (!phoneRegex.test(phone.trim())) {
    clientErrors.phone =
      "El teléfono debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)";
  }

  if (!email.trim()) {
    clientErrors.email = "El correo electrónico es obligatorio";
  } else if (!emailRegex.test(email.trim())) {
    clientErrors.email = "Correo electrónico inválido";
  }

  if (coverageType === CoverageType.HEALTH_INSURANCE) {
    if (!healthInsurerId) {
      clientErrors.healthInsurerId = "La obra social es obligatoria";
    }
    if (!insurancePlanId) {
      clientErrors.insurancePlanId = "El plan es obligatorio";
    }
    if (!memberNumber.trim()) {
      clientErrors.memberNumber = "El número de afiliado es obligatorio";
    }
    if (
      copayAmount === "" ||
      isNaN(Number(copayAmount)) ||
      Number(copayAmount) < 0
    ) {
      clientErrors.copayAmount =
        "El coseguro es obligatorio y no puede ser negativo";
    }
  }

  if (guardianName.trim()) {
    if (guardianName.trim().length > 120) {
      clientErrors.guardianName =
        "El nombre del responsable debe tener como máximo 120 caracteres";
    } else if (!nameRegex.test(guardianName.trim())) {
      clientErrors.guardianName =
        "Solo se permiten letras, espacios, tildes y apóstrofes";
    }
  }

  if (guardianPhone.trim() && !phoneRegex.test(guardianPhone.trim())) {
    clientErrors.guardianPhone =
      "El teléfono del responsable debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)";
  }

  const isFormValid = Object.keys(clientErrors).length === 0;

  // Errores del servidor
  const serverFieldErrors =
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

  const getFieldError = (fieldName: string) => {
    if (serverFieldErrors?.[fieldName]?.[0]) {
      return serverFieldErrors[fieldName][0];
    }
    if (touched[fieldName] && clientErrors[fieldName]) {
      return clientErrors[fieldName];
    }
    return null;
  };

  const getFieldBorderClass = (fieldName: string) => {
    const errorMsg = getFieldError(fieldName);
    if (errorMsg || (fieldName === "documentNumber" && isDuplicate)) {
      return "border-destructive ring-1 ring-destructive focus-visible:ring-destructive";
    }
    return "";
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isFormValid) {
      e.preventDefault();
      // Marcar todos los campos como visitados para resaltar todos los bordes rojos
      setTouched({
        lastName: true,
        firstName: true,
        documentNumber: true,
        birthDate: true,
        phone: true,
        email: true,
        healthInsurerId: true,
        insurancePlanId: true,
        memberNumber: true,
        copayAmount: true,
        guardianName: true,
        guardianPhone: true,
      });
    }
  };

  // El botón de envío debe permanecer deshabilitado o bloquear la acción si hay campos obligatorios vacíos o con errores
  const isSubmitDisabled = isPending || !isFormValid;

  return (
    <div className="flex flex-col gap-6">
      {/* Caso de éxito */}
      {state?.ok === true && (
        <Card className="border-success-soft-border bg-success-soft/30">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
            <CheckCircle2 className="size-6 text-success shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-title-lg text-success-soft-foreground">
                Paciente registrado de forma exitosa
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
            onSubmit={handleSubmit}
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
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onBlur={() => markTouched("lastName")}
                    placeholder="Ej. González"
                    className={cn(getFieldBorderClass("lastName"))}
                    aria-invalid={!!getFieldError("lastName")}
                  />
                  {getFieldError("lastName") && (
                    <p className="text-body-sm text-destructive">
                      {getFieldError("lastName")}
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
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onBlur={() => markTouched("firstName")}
                    placeholder="Ej. Martín"
                    className={cn(getFieldBorderClass("firstName"))}
                    aria-invalid={!!getFieldError("firstName")}
                  />
                  {getFieldError("firstName") && (
                    <p className="text-body-sm text-destructive">
                      {getFieldError("firstName")}
                    </p>
                  )}
                </div>

                {/* Género */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gender">
                    Género <span className="text-destructive">*</span>
                  </Label>
                  <input type="hidden" name="gender" value={gender} />
                  <Select
                    value={gender}
                    onValueChange={(val) => setGender(val as Gender)}
                  >
                    <SelectTrigger id="gender" className="h-9.5 w-full">
                      <SelectValue placeholder="Seleccionar género" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {GENDER_LABEL[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de Documento - Restringido exclusivamente a DNI */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="documentType">
                    Tipo de documento{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <input
                    type="hidden"
                    name="documentType"
                    value={documentType}
                  />
                  <Select value={documentType} disabled>
                    <SelectTrigger
                      id="documentType"
                      className="h-9.5 w-full bg-tray/60 cursor-not-allowed opacity-90"
                    >
                      <SelectValue placeholder="DNI">DNI</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DNI">
                        DNI (Documento Nacional de Identidad)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Número de Documento */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="documentNumber">
                    Número de DNI <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="documentNumber"
                    name="documentNumber"
                    required
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    onBlur={() => markTouched("documentNumber")}
                    placeholder="7 u 8 dígitos sin puntos ni espacios"
                    className={cn(
                      "font-mono",
                      getFieldBorderClass("documentNumber"),
                    )}
                    aria-invalid={
                      !!getFieldError("documentNumber") || isDuplicate
                    }
                  />
                  {getFieldError("documentNumber") && (
                    <p className="text-body-sm text-destructive">
                      {getFieldError("documentNumber")}
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
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    onBlur={() => markTouched("birthDate")}
                    className={cn(getFieldBorderClass("birthDate"))}
                    aria-invalid={!!getFieldError("birthDate")}
                  />
                  {getFieldError("birthDate") && (
                    <p className="text-body-sm text-destructive">
                      {getFieldError("birthDate")}
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
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => markTouched("phone")}
                    placeholder="Ej. +5491144556677 o 1144556677"
                    className={cn(getFieldBorderClass("phone"))}
                    aria-invalid={!!getFieldError("phone")}
                  />
                  {getFieldError("phone") && (
                    <p className="text-body-sm text-destructive">
                      {getFieldError("phone")}
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => markTouched("email")}
                    placeholder="paciente@ejemplo.com"
                    className={cn(getFieldBorderClass("email"))}
                    aria-invalid={!!getFieldError("email")}
                  />
                  {getFieldError("email") && (
                    <p className="text-body-sm text-destructive">
                      {getFieldError("email")}
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
                        setHealthInsurerId("");
                        setInsurancePlanId("");
                        setMemberNumber("");
                        setCopayAmount("0");
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
                      value={healthInsurerId}
                    />
                    <Select
                      value={healthInsurerId}
                      onValueChange={(val) => {
                        setHealthInsurerId(val);
                        setInsurancePlanId("");
                        markTouched("healthInsurerId");
                      }}
                    >
                      <SelectTrigger
                        id="healthInsurerId"
                        className={cn(
                          "h-9.5 w-full bg-card",
                          getFieldBorderClass("healthInsurerId"),
                        )}
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
                    {getFieldError("healthInsurerId") && (
                      <p className="text-body-sm text-destructive">
                        {getFieldError("healthInsurerId")}
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
                      value={insurancePlanId}
                    />
                    <Select
                      value={insurancePlanId}
                      onValueChange={(val) => {
                        setInsurancePlanId(val);
                        markTouched("insurancePlanId");
                      }}
                      disabled={!healthInsurerId || availablePlans.length === 0}
                    >
                      <SelectTrigger
                        id="insurancePlanId"
                        className={cn(
                          "h-9.5 w-full bg-card",
                          getFieldBorderClass("insurancePlanId"),
                        )}
                      >
                        <SelectValue
                          placeholder={
                            !healthInsurerId
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
                    {getFieldError("insurancePlanId") && (
                      <p className="text-body-sm text-destructive">
                        {getFieldError("insurancePlanId")}
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
                      value={memberNumber}
                      onChange={(e) => setMemberNumber(e.target.value)}
                      onBlur={() => markTouched("memberNumber")}
                      placeholder="Ej. 12345678/00"
                      className={cn(
                        "bg-card font-mono",
                        getFieldBorderClass("memberNumber"),
                      )}
                      aria-invalid={!!getFieldError("memberNumber")}
                    />
                    {getFieldError("memberNumber") && (
                      <p className="text-body-sm text-destructive">
                        {getFieldError("memberNumber")}
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
                      value={copayAmount}
                      onChange={(e) => setCopayAmount(e.target.value)}
                      onBlur={() => markTouched("copayAmount")}
                      placeholder="0.00"
                      className={cn(
                        "bg-card tabular-nums",
                        getFieldBorderClass("copayAmount"),
                      )}
                      aria-invalid={!!getFieldError("copayAmount")}
                    />
                    {getFieldError("copayAmount") && (
                      <p className="text-body-sm text-destructive">
                        {getFieldError("copayAmount")}
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
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    onBlur={() => markTouched("guardianName")}
                    placeholder="Ej. Laura González"
                    className={cn(getFieldBorderClass("guardianName"))}
                    aria-invalid={!!getFieldError("guardianName")}
                  />
                  {getFieldError("guardianName") && (
                    <p className="text-body-sm text-destructive">
                      {getFieldError("guardianName")}
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
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    onBlur={() => markTouched("guardianPhone")}
                    placeholder="Ej. +5491188990011 o 1188990011"
                    className={cn(getFieldBorderClass("guardianPhone"))}
                    aria-invalid={!!getFieldError("guardianPhone")}
                  />
                  {getFieldError("guardianPhone") && (
                    <p className="text-body-sm text-destructive">
                      {getFieldError("guardianPhone")}
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
                disabled={isSubmitDisabled}
                className="bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
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
