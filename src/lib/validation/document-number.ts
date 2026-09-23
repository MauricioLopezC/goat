/** Reglas compartidas por los formularios y la validación del servidor. */
export const documentNumberFormats = {
  DNI: {
    pattern: "[0-9]{8}",
    maxLength: 8,
    inputMode: "numeric",
    hint: "8 dígitos numéricos",
    error: "El DNI debe tener 8 dígitos numéricos",
  },
  LC: {
    pattern: "[0-9]{6,8}",
    maxLength: 8,
    inputMode: "numeric",
    hint: "6 a 8 dígitos numéricos",
    error: "La LC debe tener entre 6 y 8 dígitos numéricos",
  },
  LE: {
    pattern: "[0-9]{6,8}",
    maxLength: 8,
    inputMode: "numeric",
    hint: "6 a 8 dígitos numéricos",
    error: "La LE debe tener entre 6 y 8 dígitos numéricos",
  },
  CI: {
    pattern: "[0-9]{6,8}",
    maxLength: 8,
    inputMode: "numeric",
    hint: "6 a 8 dígitos numéricos",
    error: "La CI debe tener entre 6 y 8 dígitos numéricos",
  },
  PASSPORT: {
    pattern: "[A-Za-z0-9]{8,20}",
    maxLength: 20,
    inputMode: "text",
    hint: "8 a 20 letras o números, sin espacios",
    error: "El pasaporte debe tener entre 8 y 20 letras o números",
  },
} as const;

export const documentTypes = ["DNI", "LC", "LE", "CI", "PASSPORT"] as const;

export function documentNumberFormat(type: string) {
  return (
    documentNumberFormats[type as keyof typeof documentNumberFormats] ??
    documentNumberFormats.DNI
  );
}
