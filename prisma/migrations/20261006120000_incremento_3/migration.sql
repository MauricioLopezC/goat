-- Schema compartido del incremento 3. Conserva filas, IDs y auditoría.
-- Si hubiera ausencias antiguas superpuestas, la migración falla completa:
-- deben revisarse explícitamente, nunca se borran ni fusionan automáticamente.
BEGIN;

-- DropIndex
DROP INDEX "AvailabilityException_professionalId_date_idx";

-- DropIndex
DROP INDEX "Holiday_date_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AvailabilityException" RENAME COLUMN "date" TO "startDate";
ALTER TABLE "AvailabilityException" ADD COLUMN "endDate" DATE;
UPDATE "AvailabilityException" SET "endDate" = "startDate";
ALTER TABLE "AvailabilityException" ALTER COLUMN "endDate" SET NOT NULL;

-- AlterTable
ALTER TABLE "Holiday" RENAME COLUMN "date" TO "startDate";
ALTER TABLE "Holiday" ADD COLUMN "endDate" DATE,
ADD COLUMN "startMinute" INTEGER,
ADD COLUMN "endMinute" INTEGER;
UPDATE "Holiday" SET "endDate" = "startDate";
ALTER TABLE "Holiday" ALTER COLUMN "endDate" SET NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "cashClosingId" INTEGER,
ADD COLUMN "receiptNumber" INTEGER;
-- Incluye cobros anulados; el orden histórico es estable aun con fechas iguales.
WITH numbered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS number FROM "Payment"
)
UPDATE "Payment" p SET "receiptNumber" = numbered.number
FROM numbered WHERE p."id" = numbered."id";
CREATE SEQUENCE "Payment_receiptNumber_seq" OWNED BY "Payment"."receiptNumber";
SELECT setval('"Payment_receiptNumber_seq"',
  COALESCE((SELECT MAX("receiptNumber") FROM "Payment"), 0) + 1, false);
ALTER TABLE "Payment" ALTER COLUMN "receiptNumber" SET NOT NULL,
ALTER COLUMN "receiptNumber" SET DEFAULT nextval('"Payment_receiptNumber_seq"');

-- CreateTable
CREATE TABLE "Encounter" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "indications" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClosing" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "paymentCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "expectedCashAmount" DECIMAL(12,2) NOT NULL,
    "countedCashAmount" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "closedById" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_appointmentId_key" ON "Encounter"("appointmentId");

-- CreateIndex
CREATE INDEX "Encounter_professionalId_createdAt_idx" ON "Encounter"("professionalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosing_date_key" ON "CashClosing"("date");

-- CreateIndex
CREATE INDEX "AvailabilityException_professionalId_startDate_endDate_idx" ON "AvailabilityException"("professionalId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Holiday_startDate_endDate_idx" ON "Holiday"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_cashClosingId_idx" ON "Payment"("cashClosingId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashClosingId_fkey" FOREIGN KEY ("cashClosingId") REFERENCES "CashClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas del incremento 3 que Prisma no puede expresar.
-- Fechas inclusivas; horas [inicio, fin) repetidas en cada día del rango.
ALTER TABLE "Holiday"
  ADD CONSTRAINT "Holiday_dates_valid" CHECK ("startDate" <= "endDate"),
  ADD CONSTRAINT "Holiday_minutes_valid" CHECK (
    ("startMinute" IS NULL AND "endMinute" IS NULL) OR
    ("startMinute" IS NOT NULL AND "endMinute" IS NOT NULL
      AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute")
  ),
  ADD CONSTRAINT "Holiday_no_overlap" EXCLUDE USING gist (
    daterange("startDate", "endDate", '[]') WITH &&,
    int4range(COALESCE("startMinute", 0), COALESCE("endMinute", 1440), '[)') WITH &&
  );

-- Se corrige también el CHECK anterior: SQL acepta UNKNOWN, por eso los
-- IS NOT NULL son necesarios para rechazar un único extremo horario nulo.
ALTER TABLE "AvailabilityException"
  DROP CONSTRAINT "AvailabilityException_minutes_valid",
  ADD CONSTRAINT "AvailabilityException_dates_valid" CHECK ("startDate" <= "endDate"),
  ADD CONSTRAINT "AvailabilityException_minutes_valid" CHECK (
    ("startMinute" IS NULL AND "endMinute" IS NULL) OR
    ("startMinute" IS NOT NULL AND "endMinute" IS NOT NULL
      AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute")
  ),
  ADD CONSTRAINT "AvailabilityException_no_overlap" EXCLUDE USING gist (
    "professionalId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&,
    int4range(COALESCE("startMinute", 0), COALESCE("endMinute", 1440), '[)') WITH &&
  );

ALTER TABLE "Encounter"
  ADD CONSTRAINT "Encounter_notes_not_blank" CHECK (length(btrim("notes")) > 0);
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_receipt_number_positive" CHECK ("receiptNumber" > 0);
ALTER TABLE "CashClosing"
  ADD CONSTRAINT "CashClosing_amounts_valid" CHECK (
    "paymentCount" >= 0 AND "totalAmount" >= 0
    AND "expectedCashAmount" >= 0 AND "expectedCashAmount" <= "totalAmount"
    AND "countedCashAmount" >= 0
  ),
  ADD CONSTRAINT "CashClosing_difference_valid" CHECK (
    "difference" = "countedCashAmount" - "expectedCashAmount"
  ),
  ADD CONSTRAINT "CashClosing_difference_has_notes" CHECK (
    "difference" = 0 OR ("notes" IS NOT NULL AND length(btrim("notes")) > 0)
  );

COMMIT;
