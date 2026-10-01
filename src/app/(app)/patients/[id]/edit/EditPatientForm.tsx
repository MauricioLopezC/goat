"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import type { UpdatedPatientSummary } from "@/lib/dal/patients";
import { validatePatientClientForm } from "@/lib/patients";
import { CoverageType, DocumentType, Gender } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PatientFormFields,
  type HealthInsurerOption,
} from "../../patient-form-fields";
import { updatePatient } from "../actions";

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
  address?: string | null;
  city?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  notes?: string | null;
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

export function EditPatientForm({
  initialPatient,
  healthInsurers,
  cancelHref,
}: EditPatientFormProps) {
  const router = useRouter();

  const [lastName, setLastName] = useState(initialPatient.lastName);
  const [firstName, setFirstName] = useState(initialPatient.firstName);
  const [gender, setGender] = useState<Gender>(initialPatient.gender);
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
  const [address, setAddress] = useState(initialPatient.address ?? "");
  const [city, setCity] = useState(initialPatient.city ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(
    initialPatient.emergencyContactName ?? "",
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initialPatient.emergencyContactPhone ?? "",
  );
  const [emergencyContactRelationship, setEmergencyContactRelationship] =
    useState(initialPatient.emergencyContactRelationship ?? "");
  const [notes, setNotes] = useState(initialPatient.notes ?? "");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);
  const [successData, setSuccessData] = useState<UpdatedPatientSummary | null>(
    null,
  );

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const {
    errors: clientErrors,
    isValid: isFormValid,
    isMinor,
  } = validatePatientClientForm({
    lastName,
    firstName,
    birthDate,
    phone,
    email,
    coverageType,
    healthInsurerId,
    insurancePlanId,
    memberNumber,
    guardianName,
    guardianPhone,
    address,
    city,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelationship,
    notes,
  });

  const serverFieldErrors =
    state?.ok === false && state.error.code === "VALIDATION"
      ? state.error.fieldErrors
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
    if (errorMsg) {
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
        birthDate: true,
        phone: true,
        email: true,
        coverageType: true,
        healthInsurerId: true,
        insurancePlanId: true,
        memberNumber: true,
        guardianName: true,
        guardianPhone: true,
        address: true,
        city: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelationship: true,
        notes: true,
      });
      return;
    }

    startTransition(async () => {
      const res = await updatePatient({
        id: initialPatient.id,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        gender,
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
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        emergencyContactRelationship:
          emergencyContactRelationship.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setState(res);

      if (res.ok) {
        setSuccessData(res.data);
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
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

      {/* Error general */}
      {state?.ok === false && state.error.code !== "VALIDATION" && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle className="size-5" />
          <AlertTitle className="font-semibold">Error al actualizar</AlertTitle>
          <AlertDescription>{state.error.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <PatientFormFields
          lastName={lastName}
          setLastName={setLastName}
          firstName={firstName}
          setFirstName={setFirstName}
          documentType={initialPatient.documentType}
          setDocumentType={() => {}}
          documentNumber={initialPatient.documentNumber}
          setDocumentNumber={() => {}}
          documentLocked
          gender={gender}
          setGender={setGender}
          birthDate={birthDate}
          setBirthDate={setBirthDate}
          phone={phone}
          setPhone={setPhone}
          email={email}
          setEmail={setEmail}
          coverageType={coverageType}
          setCoverageType={setCoverageType}
          healthInsurerId={healthInsurerId}
          setHealthInsurerId={setHealthInsurerId}
          insurancePlanId={insurancePlanId}
          setInsurancePlanId={setInsurancePlanId}
          memberNumber={memberNumber}
          setMemberNumber={setMemberNumber}
          guardianName={guardianName}
          setGuardianName={setGuardianName}
          guardianPhone={guardianPhone}
          setGuardianPhone={setGuardianPhone}
          healthInsurers={healthInsurers}
          isMinor={isMinor}
          markTouched={markTouched}
          getFieldError={getFieldError}
          getFieldBorderClass={getFieldBorderClass}
        />

        {/* Domicilio (HU-17) */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-title-lg">Domicilio</CardTitle>
            <CardDescription>
              Dirección de residencia del paciente (opcional).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="address">Calle y número</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onBlur={() => markTouched("address")}
                  className={getFieldBorderClass("address")}
                  placeholder="Ej: Av. Belgrano 1234"
                  maxLength={120}
                />
                {getFieldError("address") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("address")}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Localidad</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onBlur={() => markTouched("city")}
                  className={getFieldBorderClass("city")}
                  placeholder="Ej: Salta"
                  maxLength={60}
                />
                {getFieldError("city") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("city")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacto de emergencia (HU-17) */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-title-lg">
              Contacto de emergencia
            </CardTitle>
            <CardDescription>
              Familiar o persona cercana a quien contactar ante un imprevisto.
              Si se carga el nombre, el teléfono es obligatorio, y viceversa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emergencyContactName">Nombre y apellido</Label>
                <Input
                  id="emergencyContactName"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  onBlur={() => markTouched("emergencyContactName")}
                  className={getFieldBorderClass("emergencyContactName")}
                  placeholder="Ej: María Gómez"
                  maxLength={120}
                />
                {getFieldError("emergencyContactName") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("emergencyContactName")}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emergencyContactPhone">
                  Teléfono de contacto
                </Label>
                <Input
                  id="emergencyContactPhone"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  onBlur={() => markTouched("emergencyContactPhone")}
                  className={getFieldBorderClass("emergencyContactPhone")}
                  placeholder="Ej: +543871234567"
                  maxLength={25}
                />
                {getFieldError("emergencyContactPhone") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("emergencyContactPhone")}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emergencyContactRelationship">
                  Vínculo / Relación
                </Label>
                <Input
                  id="emergencyContactRelationship"
                  value={emergencyContactRelationship}
                  onChange={(e) =>
                    setEmergencyContactRelationship(e.target.value)
                  }
                  onBlur={() => markTouched("emergencyContactRelationship")}
                  className={getFieldBorderClass(
                    "emergencyContactRelationship",
                  )}
                  placeholder="Ej: Madre, Cónyuge, Hermano"
                  maxLength={50}
                />
                {getFieldError("emergencyContactRelationship") && (
                  <p className="text-xs text-destructive mt-1">
                    {getFieldError("emergencyContactRelationship")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observaciones administrativas (HU-17) */}
        <Card className="rounded-xl border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-title-lg">
              Observaciones administrativas
            </CardTitle>
            <CardDescription>
              Anotaciones internas del mostrador y mesa de entrada. No
              constituyen antecedentes clínicos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Label htmlFor="notes">Observaciones</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => markTouched("notes")}
              className={getFieldBorderClass("notes")}
              placeholder="Anotaciones administrativas, indicaciones de mostrador, etc."
              rows={4}
              maxLength={1000}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
              {getFieldError("notes") ? (
                <p className="text-xs text-destructive">
                  {getFieldError("notes")}
                </p>
              ) : (
                <span />
              )}
              <span>{notes.length} / 1000</span>
            </div>
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
