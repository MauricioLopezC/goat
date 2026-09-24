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
import { validatePatientClientForm } from "@/lib/patients";
import { CoverageType, DocumentType, Gender } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  const {
    errors: clientErrors,
    isValid: isFormValid,
    isMinor,
  } = validatePatientClientForm({
    lastName,
    firstName,
    documentType,
    documentNumber,
    birthDate,
    phone,
    email,
    coverageType,
    healthInsurerId,
    insurancePlanId,
    memberNumber,
    guardianName,
    guardianPhone,
  });

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
        <PatientFormFields
          lastName={lastName}
          setLastName={setLastName}
          firstName={firstName}
          setFirstName={setFirstName}
          documentType={documentType}
          setDocumentType={setDocumentType}
          documentNumber={documentNumber}
          setDocumentNumber={setDocumentNumber}
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
