-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'MINOR_ISSUES', 'MAJOR_ISSUES', 'FAILED');

-- CreateTable
CREATE TABLE "InstallationInspection" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedByUserId" TEXT,
    "result" "InspectionResult" NOT NULL DEFAULT 'PASS',
    "findings" TEXT,
    "correctiveActions" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "documentId" TEXT,
    "isAnnualPSI" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallationInspection_installationId_performedAt_idx" ON "InstallationInspection"("installationId", "performedAt");

-- CreateIndex
CREATE INDEX "InstallationInspection_nextDueAt_result_idx" ON "InstallationInspection"("nextDueAt", "result");

-- AddForeignKey
ALTER TABLE "InstallationInspection" ADD CONSTRAINT "InstallationInspection_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "ProjectInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationInspection" ADD CONSTRAINT "InstallationInspection_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
