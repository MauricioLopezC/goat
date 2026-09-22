import { DocumentType, Gender, CoverageType } from "@/generated/prisma/enums";

export const DOCUMENT_TYPES = [DocumentType.DNI] as const;

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
