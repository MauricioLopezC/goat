-- CreateEnum
CREATE TYPE "AppointmentPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentEventType" ADD VALUE 'RESCHEDULED';
ALTER TYPE "AppointmentEventType" ADD VALUE 'PRIORITY_CHANGED';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "authorizationNumber" TEXT,
ADD COLUMN     "authorizedAt" TIMESTAMP(3),
ADD COLUMN     "authorizedById" INTEGER,
ADD COLUMN     "priority" "AppointmentPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "priorityReason" TEXT;

-- AlterTable
ALTER TABLE "AppointmentEvent" ADD COLUMN     "newEndsAt" TIMESTAMP(3),
ADD COLUMN     "newPriority" "AppointmentPriority",
ADD COLUMN     "newProfessionalId" INTEGER,
ADD COLUMN     "newStartsAt" TIMESTAMP(3),
ADD COLUMN     "previousEndsAt" TIMESTAMP(3),
ADD COLUMN     "previousPriority" "AppointmentPriority",
ADD COLUMN     "previousProfessionalId" INTEGER,
ADD COLUMN     "previousStartsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Coverage" DROP COLUMN "copayAmount";

-- AlterTable
-- Los feriados cargados antes de este incremento no tienen autor: se les
-- asigna el primer gerente (o, si no hay, el primer usuario) y después la
-- columna pasa a ser obligatoria.
ALTER TABLE "Holiday" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" INTEGER;

UPDATE "Holiday"
SET "createdById" = (
  SELECT "id" FROM "User"
  ORDER BY ("role" = 'MANAGER') DESC, "id"
  LIMIT 1
)
WHERE "createdById" IS NULL;

ALTER TABLE "Holiday" ALTER COLUMN "createdById" SET NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "paymentMethodId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" INTEGER,
    "voidReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE INDEX "Payment_appointmentId_idx" ON "Payment"("appointmentId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_previousProfessionalId_fkey" FOREIGN KEY ("previousProfessionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_newProfessionalId_fkey" FOREIGN KEY ("newProfessionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- Reglas que Prisma no declara en el schema (Inc. 2). Las comparaciones
-- con valores de enum van como texto (`::text`): PostgreSQL no permite usar
-- un valor recién agregado con ADD VALUE dentro de la misma transacción.
-- ─────────────────────────────────────────────────────────────────────

-- Un turno tiene como máximo un cobro vigente (HU-21). Los anulados quedan
-- como historia y no cuentan: se vuelve a cobrar con una fila nueva.
CREATE UNIQUE INDEX "Payment_one_paid_per_appointment"
  ON "Payment"("appointmentId")
  WHERE ("status" = 'PAID');

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_not_negative" CHECK ("amount" >= 0);

-- La anulación se registra completa (quién, cuándo y por qué) y solo en un
-- cobro anulado.
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_void_fields" CHECK (
    ("status" = 'VOIDED'
      AND "voidedAt" IS NOT NULL
      AND "voidedById" IS NOT NULL
      AND "voidReason" IS NOT NULL)
    OR
    ("status" = 'PAID'
      AND "voidedAt" IS NULL
      AND "voidedById" IS NULL
      AND "voidReason" IS NULL)
  );

-- Un turno urgente exige motivo (HU-19).
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_urgent_has_reason" CHECK (
    "priority" = 'NORMAL' OR "priorityReason" IS NOT NULL
  );

-- La autorización de la obra social se registra completa o no se registra
-- (HU-21).
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_authorization_fields" CHECK (
    ("authorizationNumber" IS NULL
      AND "authorizedAt" IS NULL
      AND "authorizedById" IS NULL)
    OR
    ("authorizationNumber" IS NOT NULL
      AND "authorizedAt" IS NOT NULL
      AND "authorizedById" IS NOT NULL)
  );

-- Una reprogramación guarda el horario y el profesional anteriores y nuevos
-- (HU-16); los demás tipos de evento no los usan.
ALTER TABLE "AppointmentEvent"
  ADD CONSTRAINT "AppointmentEvent_reschedule_fields" CHECK (
    ("type"::text = 'RESCHEDULED'
      AND "previousStartsAt" IS NOT NULL
      AND "previousEndsAt" IS NOT NULL
      AND "previousProfessionalId" IS NOT NULL
      AND "newStartsAt" IS NOT NULL
      AND "newEndsAt" IS NOT NULL
      AND "newProfessionalId" IS NOT NULL)
    OR
    ("type"::text <> 'RESCHEDULED'
      AND "previousStartsAt" IS NULL
      AND "previousEndsAt" IS NULL
      AND "previousProfessionalId" IS NULL
      AND "newStartsAt" IS NULL
      AND "newEndsAt" IS NULL
      AND "newProfessionalId" IS NULL)
  );

-- Un cambio de prioridad guarda la anterior y la nueva (HU-19).
ALTER TABLE "AppointmentEvent"
  ADD CONSTRAINT "AppointmentEvent_priority_fields" CHECK (
    ("type"::text = 'PRIORITY_CHANGED'
      AND "previousPriority" IS NOT NULL
      AND "newPriority" IS NOT NULL
      AND "previousPriority" <> "newPriority")
    OR
    ("type"::text <> 'PRIORITY_CHANGED'
      AND "previousPriority" IS NULL
      AND "newPriority" IS NULL)
  );

-- Nombre y teléfono del contacto de emergencia van juntos (HU-17).
ALTER TABLE "Patient"
  ADD CONSTRAINT "Patient_emergency_contact_pair" CHECK (
    ("emergencyContactName" IS NULL) = ("emergencyContactPhone" IS NULL)
  );
