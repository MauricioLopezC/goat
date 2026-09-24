"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  UserPlus,
  Loader2,
  X,
} from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import type { CreatedPatientSummary } from "@/lib/dal/patients";
import {
  GENDERS,
  GENDER_LABEL,
  COVERAGE_TYPES,
  COVERAGE_TYPE_LABEL,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
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
  cancelHref: string;
  initialQuery?: string;
}

type FormState = ActionResult<CreatedPatientSummary> | null;

const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const dniRegex = /^\d{7,8}$/;
const phoneRegex = /^\+?\d{7,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewPatientForm({
  healthInsurers,
  cancelHref,
  initialQuery,
}: NewPatientFormProps) {
  const cleanQuery = initialQuery?.trim() ?? "";
  const isNumericQuery = /^\d+$/.test(cleanQuery);
  const initialDocumentNumber = isNumericQuery ? cleanQuery : "";
  const initialLastName = !isNumericQuery ? cleanQuery : "";

  const [lastName, setLastName] = useState(initialLastName);
  const [firstName, setFirstName] = useState("");
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [documentType, setDocumentType] = useState<DocumentType>(
    DocumentType.DNI,
  );
  const [documentNumber, setDocumentNumber] = useState(initialDocumentNumber);
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [coverageType, setCoverageType] = useState<CoverageType>(
    CoverageType.PRIVATE,
  );
  const [healthInsurerId, setHealthInsurerId] = useState("");
  const [insurancePlanId, setInsurancePlanId] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);
  const [successData, setSuccessData] = useState<CreatedPatientSummary | null>(
    null,
  );
  const [showToast, setShowToast] = useState(false);

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleReset = () => {
    setLastName("");
    setFirstName("");
    setGender(Gender.MALE);
    setDocumentType(DocumentType.DNI);
    setDocumentNumber("");
    setBirthDate("");
    setPhone("");
    setEmail("");
    setCoverageType(CoverageType.PRIVATE);
    setHealthInsurerId("");
    setInsurancePlanId("");
    setMemberNumber("");
    setGuardianName("");
    setGuardianPhone("");
    setTouched({});
    setSuccessData(null);
    setState(null);
    setShowToast(false);
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
  } else if (documentType === DocumentType.DNI) {
    if (!dniRegex.test(documentNumber.trim())) {
      clientErrors.documentNumber =
        "El DNI debe tener exactamente 7 u 8 dígitos numéricos sin puntos ni espacios";
    }
  } else if (documentType === DocumentType.PASSPORT) {
    if (!/^[a-zA-Z0-9]{3,20}$/.test(documentNumber.trim())) {
      clientErrors.documentNumber =
        "El pasaporte debe tener entre 3 y 20 caracteres alfanuméricos";
    }
  } else {
    if (!/^\d{4,10}$/.test(documentNumber.trim())) {
      clientErrors.documentNumber =
        "El número de documento debe tener entre 4 y 10 dígitos numéricos";
    }
  }

  // Calcular si el paciente es menor de 16 años (para feedback visual y validación)
  let isMinor = false;
  if (birthDate) {
    const birthForAge = new Date(`${birthDate}T00:00:00`);
    if (!isNaN(birthForAge.getTime())) {
      const nowForAge = new Date();
      const todayForAge = new Date(
        nowForAge.getFullYear(),
        nowForAge.getMonth(),
        nowForAge.getDate(),
      );
      if (birthForAge <= todayForAge) {
        let computedAge = todayForAge.getFullYear() - birthForAge.getFullYear();
        const mForAge = todayForAge.getMonth() - birthForAge.getMonth();
        if (
          mForAge < 0 ||
          (mForAge === 0 && todayForAge.getDate() < birthForAge.getDate())
        ) {
          computedAge--;
        }
        isMinor = computedAge < 16;
      }
    }
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
        } else if (isMinor) {
          // Validar tutor si menor de 16 años
          if (!guardianName.trim()) {
            clientErrors.guardianName =
              "El nombre del responsable es obligatorio para menores de 16 años";
          } else if (guardianName.trim().length > 120) {
            clientErrors.guardianName =
              "El nombre del responsable debe tener como máximo 120 caracteres";
          } else if (!nameRegex.test(guardianName.trim())) {
            clientErrors.guardianName =
              "Solo se permiten letras, espacios, tildes y apóstrofes";
          }
          if (!guardianPhone.trim()) {
            clientErrors.guardianPhone =
              "El teléfono del responsable es obligatorio para menores de 16 años";
          } else if (!phoneRegex.test(guardianPhone.trim())) {
            clientErrors.guardianPhone =
              "El teléfono del responsable debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)";
          }
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
  const duplicateMeta =
    isDuplicate && state?.ok === false && state.error.meta
      ? (state.error.meta as {
          existingPatientId?: number;
          existingPatientName?: string;
          documentType?: string;
          documentNumber?: string;
        })
      : undefined;

  const duplicateId = duplicateMeta?.existingPatientId;
  const duplicateName = duplicateMeta?.existingPatientName;

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
    e.preventDefault();

    if (isPending) return;

    if (!isFormValid) {
      setTouched({
        lastName: true,
        firstName: true,
        documentType: true,
        documentNumber: true,
        birthDate: true,
        phone: true,
        email: true,
        healthInsurerId: true,
        insurancePlanId: true,
        memberNumber: true,
        guardianName: true,
        guardianPhone: true,
      });
      return;
    }

    startTransition(async () => {
      const raw = {
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        gender,
        documentType,
        documentNumber: documentNumber.trim(),
        birthDate: birthDate.trim(),
        phone: phone.trim(),
        email: email.trim(),
        coverageType,
        healthInsurerId:
          coverageType === CoverageType.HEALTH_INSURANCE && healthInsurerId
            ? Number(healthInsurerId)
            : undefined,
        insurancePlanId:
          coverageType === CoverageType.HEALTH_INSURANCE && insurancePlanId
            ? Number(insurancePlanId)
            : undefined,
        memberNumber:
          coverageType === CoverageType.HEALTH_INSURANCE
            ? memberNumber.trim()
            : undefined,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
      };

      try {
        const res = await createPatient(raw);
        setState(res);

        if (res.ok) {
          setSuccessData(res.data);
          setShowToast(true);

          // Limpiar campos del formulario
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
          setGuardianName("");
          setGuardianPhone("");
          setTouched({});

          // Scroll hacia arriba para visualizar inmediatamente la confirmación
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setSuccessData(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {
        setState({
          ok: false,
          error: {
            code: "VALIDATION",
            message: "Ocurrió un error inesperado al procesar la solicitud.",
          },
        });
      }
    });
  };

  const isSubmitDisabled = isPending;

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Toast flotante de éxito */}
      {showToast && successData && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-success-soft-border bg-card p-4 shadow-lg animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          <CheckCircle2 className="size-5 text-success shrink-0" />
          <div className="text-body-md font-medium text-foreground">
            Paciente registrado de forma exitosa
          </div>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            className="ml-2 text-muted-foreground hover:text-foreground"
            aria-label="Cerrar notificación"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Caso de éxito - Alerta principal */}
      {successData && (
        <Card className="border-success-soft-border bg-success-soft/30 animate-in fade-in duration-300">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
            <CheckCircle2 className="size-6 text-success shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-title-lg text-success-soft-foreground">
                Paciente registrado de forma exitosa
              </CardTitle>
              <CardDescription className="text-body-md text-muted-foreground mt-1">
                Se guardó la ficha de{" "}
                <strong className="text-foreground">
                  {successData.lastName}, {successData.firstName}
                </strong>{" "}
                con {successData.documentType}{" "}
                <span className="font-mono tabular-nums font-semibold">
                  {successData.documentNumber}
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
              <Link href={`/appointments/new?patientId=${successData.id}`}>
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
          className="border-warning-soft-border bg-warning-soft/30 text-warning-soft-foreground animate-in fade-in duration-300"
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
                    aria-describedby={
                      getFieldError("lastName") ? "lastName-error" : undefined
                    }
                    disabled={isPending}
                  />
                  {getFieldError("lastName") && (
                    <p
                      id="lastName-error"
                      className="text-body-sm text-destructive"
                    >
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
                    aria-describedby={
                      getFieldError("firstName") ? "firstName-error" : undefined
                    }
                    disabled={isPending}
                  />
                  {getFieldError("firstName") && (
                    <p
                      id="firstName-error"
                      className="text-body-sm text-destructive"
                    >
                      {getFieldError("firstName")}
                    </p>
                  )}
                </div>

                {/* Género */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gender">
                    Género <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={gender}
                    onValueChange={(val) => setGender(val as Gender)}
                    disabled={isPending}
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

                {/* Tipo de Documento */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="documentType">
                    Tipo de documento{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={documentType}
                    onValueChange={(val) => {
                      setDocumentType(val as DocumentType);
                      markTouched("documentType");
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger id="documentType" className="h-9.5 w-full">
                      <SelectValue placeholder="Seleccionar tipo de documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>
                          {DOCUMENT_TYPE_LABEL[dt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Número de Documento */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="documentNumber">
                    {documentType === DocumentType.DNI
                      ? "Número de DNI"
                      : "Número de documento"}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="documentNumber"
                    name="documentNumber"
                    required
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    onBlur={() => markTouched("documentNumber")}
                    placeholder={
                      documentType === DocumentType.DNI
                        ? "7 u 8 dígitos sin puntos ni espacios"
                        : "Número de documento"
                    }
                    className={cn(
                      "font-mono",
                      getFieldBorderClass("documentNumber"),
                    )}
                    aria-invalid={
                      !!getFieldError("documentNumber") || isDuplicate
                    }
                    aria-describedby={
                      getFieldError("documentNumber")
                        ? "documentNumber-error"
                        : undefined
                    }
                    disabled={isPending}
                  />
                  {getFieldError("documentNumber") && (
                    <p
                      id="documentNumber-error"
                      className="text-body-sm text-destructive"
                    >
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
                    aria-describedby={
                      getFieldError("birthDate") ? "birthDate-error" : undefined
                    }
                    disabled={isPending}
                  />
                  {getFieldError("birthDate") && (
                    <p
                      id="birthDate-error"
                      className="text-body-sm text-destructive"
                    >
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
                    aria-describedby={
                      getFieldError("phone") ? "phone-error" : undefined
                    }
                    disabled={isPending}
                  />
                  {getFieldError("phone") && (
                    <p
                      id="phone-error"
                      className="text-body-sm text-destructive"
                    >
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
                    aria-describedby={
                      getFieldError("email") ? "email-error" : undefined
                    }
                    disabled={isPending}
                  />
                  {getFieldError("email") && (
                    <p
                      id="email-error"
                      className="text-body-sm text-destructive"
                    >
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
              <div
                role="radiogroup"
                aria-label="Tipo de cobertura"
                className="flex gap-4 mb-4"
              >
                {COVERAGE_TYPES.map((type) => {
                  const isSelected = coverageType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isPending}
                      onClick={() => {
                        setCoverageType(type);
                        if (type === CoverageType.PRIVATE) {
                          setHealthInsurerId("");
                          setInsurancePlanId("");
                          setMemberNumber("");
                        }
                      }}
                      className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary-soft/20 ring-2 ring-primary/20"
                          : "border-border bg-card hover:bg-tray"
                      } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
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
                  );
                })}
              </div>

              {/* Campos condicionales para obra social */}
              {coverageType === CoverageType.HEALTH_INSURANCE && (
                <div className="rounded-lg border border-border p-4 bg-tray/40 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
                  {/* Obra Social */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="healthInsurerId">
                      Obra social <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={healthInsurerId}
                      onValueChange={(val) => {
                        setHealthInsurerId(val);
                        setInsurancePlanId("");
                        markTouched("healthInsurerId");
                      }}
                      disabled={isPending}
                    >
                      <SelectTrigger
                        id="healthInsurerId"
                        className={cn(
                          "h-9.5 w-full bg-card",
                          getFieldBorderClass("healthInsurerId"),
                        )}
                        aria-invalid={!!getFieldError("healthInsurerId")}
                        aria-describedby={
                          getFieldError("healthInsurerId")
                            ? "healthInsurerId-error"
                            : undefined
                        }
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
                      <p
                        id="healthInsurerId-error"
                        className="text-body-sm text-destructive"
                      >
                        {getFieldError("healthInsurerId")}
                      </p>
                    )}
                  </div>

                  {/* Plan */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="insurancePlanId">
                      Plan <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={insurancePlanId}
                      onValueChange={(val) => {
                        setInsurancePlanId(val);
                        markTouched("insurancePlanId");
                      }}
                      disabled={
                        isPending ||
                        !healthInsurerId ||
                        availablePlans.length === 0
                      }
                    >
                      <SelectTrigger
                        id="insurancePlanId"
                        className={cn(
                          "h-9.5 w-full bg-card",
                          getFieldBorderClass("insurancePlanId"),
                        )}
                        aria-invalid={!!getFieldError("insurancePlanId")}
                        aria-describedby={
                          getFieldError("insurancePlanId")
                            ? "insurancePlanId-error"
                            : undefined
                        }
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
                      <p
                        id="insurancePlanId-error"
                        className="text-body-sm text-destructive"
                      >
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
                      aria-describedby={
                        getFieldError("memberNumber")
                          ? "memberNumber-error"
                          : undefined
                      }
                      disabled={isPending}
                    />
                    {getFieldError("memberNumber") && (
                      <p
                        id="memberNumber-error"
                        className="text-body-sm text-destructive"
                      >
                        {getFieldError("memberNumber")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* SECCIÓN 4: Responsable o tutor */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-label-sm font-semibold uppercase text-muted-foreground tracking-wider">
                  {isMinor
                    ? "Responsable o tutor (obligatorio para menores de 16 años)"
                    : "Responsable o tutor (opcional)"}
                </h3>
                {!isMinor && (
                  <span className="text-body-sm text-muted-foreground">
                    Para menores de edad o pacientes a cargo
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre del tutor */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="guardianName">
                    Nombre del responsable o tutor{" "}
                    {isMinor && <span className="text-destructive">*</span>}
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
                    aria-describedby={
                      getFieldError("guardianName")
                        ? "guardianName-error"
                        : undefined
                    }
                    disabled={isPending}
                  />
                  {getFieldError("guardianName") && (
                    <p
                      id="guardianName-error"
                      className="text-body-sm text-destructive"
                    >
                      {getFieldError("guardianName")}
                    </p>
                  )}
                </div>

                {/* Teléfono del tutor */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="guardianPhone">
                    Teléfono del responsable{" "}
                    {isMinor && <span className="text-destructive">*</span>}
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
                    aria-describedby={
                      getFieldError("guardianPhone")
                        ? "guardianPhone-error"
                        : undefined
                    }
                    disabled={isPending}
                  />
                  {getFieldError("guardianPhone") && (
                    <p
                      id="guardianPhone-error"
                      className="text-body-sm text-destructive"
                    >
                      {getFieldError("guardianPhone")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button asChild variant="outline" disabled={isPending}>
                <Link href={cancelHref}>Cancelar</Link>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled}
                className="bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed min-w-36"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin inline-start" />
                    Registrando...
                  </>
                ) : (
                  "Registrar paciente"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
