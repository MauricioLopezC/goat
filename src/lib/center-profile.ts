// Datos del centro configurados en un solo lugar (HU-24, glossary.md).
// Los usa el comprobante de cobro.

export const centerProfile = {
  name: "GOAT Policonsultorio",
  legalName: "GOAT Traumatología S.A.",
  cuit: "30-71234567-9",
  address: "Av. Pres. Julio A. Roca 620, CABA",
  phone: "+54 11 5555-4628",
  email: "contacto@goat.local",
  legend: "Comprobante no válido como factura",
} as const;

export type CenterProfile = typeof centerProfile;

/// Formatea el número correlativo de comprobante con 8 dígitos (ej. "Nº 00000001").
export function formatReceiptNumber(receiptNumber: number): string {
  return `Nº ${receiptNumber.toString().padStart(8, "0")}`;
}
