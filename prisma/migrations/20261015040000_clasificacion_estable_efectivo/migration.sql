-- Clasificación estable de medios de pago y cobros en efectivo (HU-27).
-- Permite que renombrar el medio de pago no altere el arqueo ni los totales corregidos post-cierre.

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN "isCash" BOOLEAN NOT NULL DEFAULT false;

-- Backfill de medios en efectivo existentes
UPDATE "PaymentMethod"
SET "isCash" = true
WHERE LOWER("name") = 'efectivo' OR LOWER("name") LIKE '%efectivo%';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "isCash" BOOLEAN NOT NULL DEFAULT false;

-- Backfill de cobros en efectivo existentes a partir del medio utilizado
UPDATE "Payment" p
SET "isCash" = pm."isCash"
FROM "PaymentMethod" pm
WHERE p."paymentMethodId" = pm."id";
