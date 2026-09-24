import { DocumentType, Gender, CoverageType } from "@/generated/prisma/enums";

export const DOCUMENT_TYPES = [
  DocumentType.DNI,
  DocumentType.LC,
  DocumentType.LE,
  DocumentType.CI,
  DocumentType.PASSPORT,
] as const;

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  DNI: "DNI",
  LC: "Libreta Cívica (LC)",
  LE: "Libreta de Enrolamiento (LE)",
  CI: "Cédula de Identidad (CI)",
  PASSPORT: "Pasaporte",
};

export const GENDERS = [Gender.MALE, Gender.FEMALE, Gender.OTHER] as const;

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Masculino",
  FEMALE: "Femenino",
  OTHER: "Otro",
};

export const COVERAGE_TYPES = [
  CoverageType.PRIVATE,
  CoverageType.HEALTH_INSURANCE,
] as const;

export const COVERAGE_TYPE_LABEL: Record<CoverageType, string> = {
  PRIVATE: "Particular",
  HEALTH_INSURANCE: "Obra social",
};

export const PATIENT_NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
export const DNI_REGEX = /^\d{7,8}$/;
export const PHONE_REGEX = /^\+?\d{7,15}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Calcula la edad en años a partir de una fecha de nacimiento (UTC/local seguro).
export function calculateAge(date: Date | string): number {
  const birth = new Date(date);
  if (isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getUTCFullYear();
  const m = now.getMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

export type PatientFormValidationInput = {
  lastName: string;
  firstName: string;
  documentType: DocumentType;
  documentNumber: string;
  birthDate: string;
  phone: string;
  email: string;
  coverageType: CoverageType;
  healthInsurerId?: string;
  insurancePlanId?: string;
  memberNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
};

/// Validador unificado de formularios de paciente (alta y edición) en el cliente.
export function validatePatientClientForm(data: PatientFormValidationInput) {
  const errors: Record<string, string> = {};

  if (!data.lastName.trim()) {
    errors.lastName = "El apellido es obligatorio";
  } else if (data.lastName.trim().length < 2) {
    errors.lastName = "El apellido debe tener al menos 2 caracteres";
  } else if (data.lastName.trim().length > 60) {
    errors.lastName = "El apellido debe tener como máximo 60 caracteres";
  } else if (!PATIENT_NAME_REGEX.test(data.lastName.trim())) {
    errors.lastName = "Solo se permiten letras, espacios, tildes y apóstrofes";
  }

  if (!data.firstName.trim()) {
    errors.firstName = "El nombre es obligatorio";
  } else if (data.firstName.trim().length < 2) {
    errors.firstName = "El nombre debe tener al menos 2 caracteres";
  } else if (data.firstName.trim().length > 60) {
    errors.firstName = "El nombre debe tener como máximo 60 caracteres";
  } else if (!PATIENT_NAME_REGEX.test(data.firstName.trim())) {
    errors.firstName = "Solo se permiten letras, espacios, tildes y apóstrofes";
  }

  if (!data.documentNumber.trim()) {
    errors.documentNumber = "El número de documento es obligatorio";
  } else if (data.documentType === DocumentType.DNI) {
    if (!DNI_REGEX.test(data.documentNumber.trim())) {
      errors.documentNumber =
        "El DNI debe tener exactamente 7 u 8 dígitos numéricos sin puntos ni espacios";
    }
  } else if (data.documentType === DocumentType.PASSPORT) {
    if (!/^[a-zA-Z0-9]{3,20}$/.test(data.documentNumber.trim())) {
      errors.documentNumber =
        "El pasaporte debe tener entre 3 y 20 caracteres alfanuméricos";
    }
  } else {
    if (!/^\d{4,10}$/.test(data.documentNumber.trim())) {
      errors.documentNumber =
        "El número de documento debe tener entre 4 y 10 dígitos numéricos";
    }
  }

  let isMinor = false;
  if (data.birthDate) {
    const birthForAge = new Date(`${data.birthDate}T00:00:00`);
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

  if (!data.birthDate) {
    errors.birthDate = "La fecha de nacimiento es obligatoria";
  } else {
    const birth = new Date(`${data.birthDate}T00:00:00`);
    if (isNaN(birth.getTime())) {
      errors.birthDate = "Fecha inválida";
    } else {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (birth > today) {
        errors.birthDate = "La fecha de nacimiento no puede ser futura";
      } else {
        const minDate = new Date(
          now.getFullYear() - 120,
          now.getMonth(),
          now.getDate(),
        );
        if (birth < minDate) {
          errors.birthDate =
            "La fecha de nacimiento no puede ser anterior a 120 años";
        } else if (isMinor) {
          if (!data.guardianName?.trim()) {
            errors.guardianName =
              "El nombre del responsable es obligatorio para menores de 16 años";
          } else if (data.guardianName.trim().length > 120) {
            errors.guardianName =
              "El nombre del responsable debe tener como máximo 120 caracteres";
          } else if (!PATIENT_NAME_REGEX.test(data.guardianName.trim())) {
            errors.guardianName =
              "Solo se permiten letras, espacios, tildes y apóstrofes";
          }

          if (!data.guardianPhone?.trim()) {
            errors.guardianPhone =
              "El teléfono del responsable es obligatorio para menores de 16 años";
          } else if (!PHONE_REGEX.test(data.guardianPhone.trim())) {
            errors.guardianPhone =
              "El teléfono del responsable debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)";
          }
        }
      }
    }
  }

  if (!data.phone.trim()) {
    errors.phone = "El teléfono es obligatorio";
  } else if (!PHONE_REGEX.test(data.phone.trim())) {
    errors.phone =
      "El teléfono debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)";
  }

  if (!data.email.trim()) {
    errors.email = "El correo electrónico es obligatorio";
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = "Correo electrónico inválido";
  }

  if (data.coverageType === CoverageType.HEALTH_INSURANCE) {
    if (!data.healthInsurerId) {
      errors.healthInsurerId = "La obra social es obligatoria";
    }
    if (!data.insurancePlanId) {
      errors.insurancePlanId = "El plan es obligatorio";
    }
    if (!data.memberNumber?.trim()) {
      errors.memberNumber = "El número de afiliado es obligatorio";
    }
  }

  if (data.guardianName?.trim()) {
    if (data.guardianName.trim().length > 120) {
      errors.guardianName =
        "El nombre del responsable debe tener como máximo 120 caracteres";
    } else if (!PATIENT_NAME_REGEX.test(data.guardianName.trim())) {
      errors.guardianName =
        "Solo se permiten letras, espacios, tildes y apóstrofes";
    }
  }

  if (
    data.guardianPhone?.trim() &&
    !PHONE_REGEX.test(data.guardianPhone.trim())
  ) {
    errors.guardianPhone =
      "El teléfono del responsable debe contener únicamente números y puede comenzar con el signo + (entre 7 y 15 dígitos)";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    isMinor,
  };
}
