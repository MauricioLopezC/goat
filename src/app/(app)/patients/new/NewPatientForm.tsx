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
import { validatePatientClientForm } from "@/lib/patients";
import { CoverageType, DocumentType, Gender } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PatientFormFields,
  type HealthInsurerOption,
} from "../patient-form-fields";
import { createPatient } from "./actions";

interface NewPatientFormProps {
  healthInsurers: HealthInsurerOption[];
  cancelHref: string;
  initialQuery?: string;
}

type FormState = ActionResult<CreatedPatientSummary> | null;

export function NewPatientForm({
  healthInsurers,
  cancelHref,
  initialQuery,
}: NewPatientFormProps) {
  const cleanQuery = initialQuery?.trim() ?? "";
  const isDocumentLike = /^[\d.-]+$/.test(cleanQuery);
  const initialDocumentNumber = isDocumentLike
    ? cleanQuery.replace(/\D/g, "")
    : "";
  const initialLastName = !isDocumentLike ? cleanQuery : "";

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

  const resetFields = () => {
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
  };

  const handleReset = () => {
    resetFields();
    setSuccessData(null);
    setState(null);
    setShowToast(false);
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
          resetFields();
          setSuccessData(res.data);
          setShowToast(true);

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
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
    </div>
  );
}
