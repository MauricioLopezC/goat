"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
} from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import type { UpdatedPatientSummary } from "@/lib/dal/patients";
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
import { cn } from "cn";
import { updatePatient } from "../actions";

type HealthInsurerOption = {
  id: number;
  name: string;
  plans: { id: number; name: string }[];
};

export type PatientInitialData = {
  id: number;
  lastName: string;
  firstName: string;
  gender: Gender;
  documentType: DocumentType;
  documentNumber: string;
  birthDate: string; // YYYY-MM-DD
  phone: string;
  email: string;
  coverageType: CoverageType;
  guardianName?: string | null;
  guardianPhone?: string | null;
  healthInsurerId?: number;
  insurancePlanId?: number;
  memberNumber?: string;
};

interface EditPatientFormProps {
  initialPatient: PatientInitialData;
  healthInsurers: HealthInsurerOption[];
  cancelHref: string;
}

type FormState = ActionResult<UpdatedPatientSummary> | null;

const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const dniRegex = /^\d{7,8}$/;
const phoneRegex = /^\+?\d{7,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditPatientForm({
  initialPatient,
  healthInsurers,
  cancelHref,
}: EditPatientFormProps) {
  const router = useRouter();

  const [lastName, setLastName] = useState(initialPatient.lastName);
  const [firstName, setFirstName] = useState(initialPatient.firstName);
  const [gender, setGender] = useState<Gender>(initialPatient.gender);
  const [documentType, setDocumentType] = useState<DocumentType>(
    initialPatient.documentType,
  );
  const [documentNumber, setDocumentNumber] = useState(
    initialPatient.documentNumber,
  );
  const [birthDate, setBirthDate] = useState(initialPatient.birthDate);
  const [phone, setPhone] = useState(initialPatient.phone);
  const [email, setEmail] = useState(initialPatient.email);
  const [coverageType, setCoverageType] = useState<CoverageType>(
    initialPatient.coverageType,
  );
  const [healthInsurerId, setHealthInsurerId] = useState<string>(
    initialPatient.healthInsurerId
      ? String(initialPatient.healthInsurerId)
      : "",
  );
  const [insurancePlanId, setInsurancePlanId] = useState<string>(
    initialPatient.insurancePlanId
      ? String(initialPatient.insurancePlanId)
      : "",
  );
  const [memberNumber, setMemberNumber] = useState(
    initialPatient.memberNumber ?? "",
  );
  const [guardianName, setGuardianName] = useState(
    initialPatient.guardianName ?? "",
  );
  const [guardianPhone, setGuardianPhone] = useState(
    initialPatient.guardianPhone ?? "",
  );

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);
  const [successData, setSuccessData] = useState<UpdatedPatientSummary | null>(
    null,
  );

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const selectedInsurer = healthInsurers.find(
    (ins) => String(ins.id) === healthInsurerId,
  );
  const availablePlans = selectedInsurer ? selectedInsurer.plans : [];

  // Validaciones en cliente
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
        coverageType: true,
        healthInsurerId: true,
        insurancePlanId: true,
        memberNumber: true,
        guardianName: true,
        guardianPhone: true,
      });
      return;
    }

    startTransition(async () => {
      const res = await updatePatient({
        id: initialPatient.id,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        gender,
        documentType,
        documentNumber: documentNumber.trim(),
        birthDate,
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
      });

      setState(res);

      if (res.ok) {
        setSuccessData(res.data);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Mensaje de éxito */}
      {successData && (
        <Alert className="border-success-soft-border bg-success-soft text-success-soft-foreground rounded-xl">
          <CheckCircle2 className="size-5 text-success" />
          <div className="flex-1">
            <AlertTitle className="text-title-md font-semibold text-success-soft-foreground">
              Paciente modificado con éxito
            </AlertTitle>
            <AlertDescription className="text-body-sm text-success-soft-foreground mt-1">
              Los datos de {successData.lastName}, {successData.firstName} (
              {successData.documentType} {successData.documentNumber}) fueron
              actualizados correctamente.
            </AlertDescription>
            <div className="mt-3 flex gap-2">
              <Button asChild size="sm" variant="default">
                <Link href={cancelHref}>Volver a la ficha</Link>
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Alerta de duplicado */}
      {isDuplicate && (
        <Alert
          variant="destructive"
          className="border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground rounded-xl"
        >
          <AlertCircle className="size-5 text-destructive" />
          <div className="flex-1">
            <AlertTitle className="text-title-md font-semibold text-destructive-soft-foreground">
              Documento ya registrado
            </AlertTitle>
            <AlertDescription className="text-body-sm text-destructive-soft-foreground mt-1">
              {state?.ok === false && state.error.message}
            </AlertDescription>
            {duplicateMeta?.existingPatientId && (
              <div className="mt-3">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="bg-card text-foreground border-destructive-soft-border hover:bg-tray gap-1.5"
                >
                  <Link
                    href={`/patients/${duplicateMeta.existingPatientId}`}
                    target="_blank"
                  >
                    <span>Ver ficha del paciente existente</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </Alert>
      )}

      {/* Error general */}
      {state?.ok === false &&
        state.error.code !== "VALIDATION" &&
        state.error.code !== "DUPLICATE_PATIENT" && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="size-5" />
            <AlertTitle className="font-semibold">
              Error al actualizar
            </AlertTitle>
            <AlertDescription>{state.error.message}</AlertDescription>
          </Alert>
        )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos Personales */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-title-lg">Datos personales</CardTitle>
            <CardDescription>
              Identificación y datos biográficos básicos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Apellido */}
              <div className="space-y-1.5">
                <Label htmlFor="lastName">
                  Apellido <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onBlur={() => markTouched("lastName")}
                  className={getFieldBorderClass("lastName")}
                  placeholder="Ej: Pérez"
                  maxLength={60}
                />
                {getFieldError("lastName") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("lastName")}
                  </p>
                )}
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <Label htmlFor="firstName">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onBlur={() => markTouched("firstName")}
                  className={getFieldBorderClass("firstName")}
                  placeholder="Ej: Juan Carlos"
                  maxLength={60}
                />
                {getFieldError("firstName") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("firstName")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tipo de Documento */}
              <div className="space-y-1.5">
                <Label htmlFor="documentType">
                  Tipo de documento <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={documentType}
                  onValueChange={(val: DocumentType) => {
                    setDocumentType(val);
                    markTouched("documentType");
                  }}
                >
                  <SelectTrigger
                    id="documentType"
                    className={getFieldBorderClass("documentType")}
                  >
                    <SelectValue placeholder="Seleccioná un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {DOCUMENT_TYPE_LABEL[dt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getFieldError("documentType") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("documentType")}
                  </p>
                )}
              </div>

              {/* Número de Documento */}
              <div className="space-y-1.5">
                <Label htmlFor="documentNumber">
                  Número de documento{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="documentNumber"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  onBlur={() => markTouched("documentNumber")}
                  className={cn(
                    "font-mono",
                    getFieldBorderClass("documentNumber"),
                  )}
                  placeholder="Ej: 35123456"
                  maxLength={20}
                />
                {getFieldError("documentNumber") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("documentNumber")}
                  </p>
                )}
              </div>

              {/* Género */}
              <div className="space-y-1.5">
                <Label htmlFor="gender">
                  Género <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={gender}
                  onValueChange={(val: Gender) => {
                    setGender(val);
                    markTouched("gender");
                  }}
                >
                  <SelectTrigger
                    id="gender"
                    className={getFieldBorderClass("gender")}
                  >
                    <SelectValue placeholder="Seleccioná un género" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getFieldError("gender") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("gender")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Fecha de Nacimiento */}
              <div className="space-y-1.5">
                <Label htmlFor="birthDate">
                  Fecha de nacimiento{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    markTouched("birthDate");
                  }}
                  onBlur={() => markTouched("birthDate")}
                  className={getFieldBorderClass("birthDate")}
                />
                {getFieldError("birthDate") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("birthDate")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacto */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-title-lg">
              Información de contacto
            </CardTitle>
            <CardDescription>
              Datos para envío de avisos y recordatorios.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Teléfono */}
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Teléfono <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => markTouched("phone")}
                  className={getFieldBorderClass("phone")}
                  placeholder="Ej: +5491112345678"
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground">
                  Entre 7 y 15 dígitos numéricos, opcionalmente iniciando con +.
                </p>
                {getFieldError("phone") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("phone")}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Correo electrónico <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => markTouched("email")}
                  className={getFieldBorderClass("email")}
                  placeholder="paciente@ejemplo.com"
                  maxLength={254}
                />
                {getFieldError("email") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("email")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Responsable o Tutor */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-title-lg">
                Responsable o tutor
              </CardTitle>
              {isMinor && (
                <Badge
                  variant="secondary"
                  className="bg-info-soft text-info-soft-foreground border-info-soft-border text-xs rounded-lg font-medium"
                >
                  Obligatorio (menor de 16 años)
                </Badge>
              )}
            </div>
            <CardDescription>
              {isMinor
                ? "El paciente tiene menos de 16 años, por lo que los datos del tutor son obligatorios."
                : "Datos opcionales para contacto de adultos acompañantes o responsables."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="guardianName">
                  Nombre del responsable{" "}
                  {isMinor && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="guardianName"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  onBlur={() => markTouched("guardianName")}
                  className={getFieldBorderClass("guardianName")}
                  placeholder="Ej: María Gómez (madre)"
                  maxLength={120}
                />
                {getFieldError("guardianName") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("guardianName")}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="guardianPhone">
                  Teléfono del responsable{" "}
                  {isMinor && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="guardianPhone"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  onBlur={() => markTouched("guardianPhone")}
                  className={getFieldBorderClass("guardianPhone")}
                  placeholder="Ej: +5491187654321"
                  maxLength={25}
                />
                {getFieldError("guardianPhone") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("guardianPhone")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cobertura */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-title-lg">Cobertura médica</CardTitle>
            <CardDescription>
              Modalidad de cobertura: particular u obra social.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-sm">
              <Label htmlFor="coverageType">
                Tipo de cobertura <span className="text-destructive">*</span>
              </Label>
              <Select
                value={coverageType}
                onValueChange={(val: CoverageType) => {
                  setCoverageType(val);
                  markTouched("coverageType");
                }}
              >
                <SelectTrigger
                  id="coverageType"
                  className={getFieldBorderClass("coverageType")}
                >
                  <SelectValue placeholder="Seleccioná cobertura" />
                </SelectTrigger>
                <SelectContent>
                  {COVERAGE_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {COVERAGE_TYPE_LABEL[ct]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getFieldError("coverageType") && (
                <p className="text-xs text-destructive mt-1">
                  {getFieldError("coverageType")}
                </p>
              )}
            </div>

            {coverageType === CoverageType.HEALTH_INSURANCE && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Obra Social */}
                <div className="space-y-1.5">
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
                  >
                    <SelectTrigger
                      id="healthInsurerId"
                      className={getFieldBorderClass("healthInsurerId")}
                    >
                      <SelectValue placeholder="Seleccioná obra social" />
                    </SelectTrigger>
                    <SelectContent>
                      {healthInsurers.map((hi) => (
                        <SelectItem key={hi.id} value={String(hi.id)}>
                          {hi.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {getFieldError("healthInsurerId") && (
                    <p className="text-xs text-destructive mt-1">
                      {getFieldError("healthInsurerId")}
                    </p>
                  )}
                </div>

                {/* Plan */}
                <div className="space-y-1.5">
                  <Label htmlFor="insurancePlanId">
                    Plan <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={insurancePlanId}
                    disabled={!healthInsurerId || availablePlans.length === 0}
                    onValueChange={(val) => {
                      setInsurancePlanId(val);
                      markTouched("insurancePlanId");
                    }}
                  >
                    <SelectTrigger
                      id="insurancePlanId"
                      className={getFieldBorderClass("insurancePlanId")}
                    >
                      <SelectValue
                        placeholder={
                          !healthInsurerId
                            ? "Elegí primero una obra social"
                            : "Seleccioná un plan"
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
                    <p className="text-xs text-destructive mt-1">
                      {getFieldError("insurancePlanId")}
                    </p>
                  )}
                </div>

                {/* Nº Afiliado */}
                <div className="space-y-1.5">
                  <Label htmlFor="memberNumber">
                    Número de afiliado{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="memberNumber"
                    value={memberNumber}
                    onChange={(e) => setMemberNumber(e.target.value)}
                    onBlur={() => markTouched("memberNumber")}
                    className={cn(
                      "font-mono",
                      getFieldBorderClass("memberNumber"),
                    )}
                    placeholder="Ej: 12-345678-90"
                    maxLength={50}
                  />
                  {getFieldError("memberNumber") && (
                    <p className="text-xs text-destructive mt-1">
                      {getFieldError("memberNumber")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" asChild disabled={isPending}>
            <Link href={cancelHref}>Cancelar</Link>
          </Button>

          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Guardando cambios...</span>
              </>
            ) : (
              <>
                <Save className="size-4" />
                <span>Guardar cambios</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
