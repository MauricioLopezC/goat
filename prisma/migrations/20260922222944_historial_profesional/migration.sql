-- CreateEnum
CREATE TYPE "ProfessionalEventType" AS ENUM ('UPDATED', 'DEACTIVATED', 'REACTIVATED');

-- CreateTable
CREATE TABLE "ProfessionalEvent" (
    "id" SERIAL NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "type" "ProfessionalEventType" NOT NULL,
    "reason" TEXT NOT NULL,
    "changes" JSONB,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessionalEvent_professionalId_createdAt_idx" ON "ProfessionalEvent"("professionalId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProfessionalEvent" ADD CONSTRAINT "ProfessionalEvent_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalEvent" ADD CONSTRAINT "ProfessionalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
