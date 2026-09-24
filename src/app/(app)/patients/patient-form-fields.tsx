"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import {
  GENDERS,
  GENDER_LABEL,
  COVERAGE_TYPES,
  COVERAGE_TYPE_LABEL,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
} from "@/lib/patients";
import { CoverageType, DocumentType, Gender } from "@/generated/prisma/enums";

export type HealthInsurerOption = {
  id: number;
  name: string;
  plans: { id: number; name: string }[];
};

export interface PatientFormFieldsProps {
  lastName: string;
  setLastName: (val: string) => void;
  firstName: string;
  setFirstName: (val: string) => void;
  documentType: DocumentType;
  setDocumentType: (val: DocumentType) => void;
  documentNumber: string;
  setDocumentNumber: (val: string) => void;
  gender: Gender;
  setGender: (val: Gender) => void;
  birthDate: string;
  setBirthDate: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  coverageType: CoverageType;
  setCoverageType: (val: CoverageType) => void;
  healthInsurerId: string;
  setHealthInsurerId: (val: string) => void;
  insurancePlanId: string;
  setInsurancePlanId: (val: string) => void;
  memberNumber: string;
  setMemberNumber: (val: string) => void;
  guardianName: string;
  setGuardianName: (val: string) => void;
  guardianPhone: string;
  setGuardianPhone: (val: string) => void;
  healthInsurers: HealthInsurerOption[];
  isMinor: boolean;
  markTouched: (field: string) => void;
  getFieldError: (field: string) => string | null;
  getFieldBorderClass: (field: string) => string;
}

export function PatientFormFields({
  lastName,
  setLastName,
  firstName,
  setFirstName,
  documentType,
  setDocumentType,
  documentNumber,
  setDocumentNumber,
  gender,
  setGender,
  birthDate,
  setBirthDate,
  phone,
  setPhone,
  email,
  setEmail,
  coverageType,
  setCoverageType,
  healthInsurerId,
  setHealthInsurerId,
  insurancePlanId,
  setInsurancePlanId,
  memberNumber,
  setMemberNumber,
  guardianName,
  setGuardianName,
  guardianPhone,
  setGuardianPhone,
  healthInsurers,
  isMinor,
  markTouched,
  getFieldError,
  getFieldBorderClass,
}: PatientFormFieldsProps) {
  const selectedInsurer = healthInsurers.find(
    (ins) => String(ins.id) === healthInsurerId,
  );
  const availablePlans = selectedInsurer ? selectedInsurer.plans : [];

  return (
    <>
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
                Número de documento <span className="text-destructive">*</span>
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
                Fecha de nacimiento <span className="text-destructive">*</span>
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
            <CardTitle className="text-title-lg">Responsable o tutor</CardTitle>
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
                  Número de afiliado <span className="text-destructive">*</span>
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
    </>
  );
}
