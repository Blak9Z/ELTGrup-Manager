-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('INSTALLED', 'UNDER_TEST', 'CERTIFIED', 'UNDER_MAINTENANCE', 'DECOMMISSIONED');

-- AlterEnum
ALTER TYPE "PermissionResource" ADD VALUE 'OFFERS';

-- CreateTable
CREATE TABLE "ProjectInstallation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT,
    "serialNumber" TEXT,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 24,
    "installedAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "documentId" TEXT,
    "status" "InstallationStatus" NOT NULL DEFAULT 'INSTALLED',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectInstallation_projectId_status_idx" ON "ProjectInstallation"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectInstallation_status_nextCheckAt_idx" ON "ProjectInstallation"("status", "nextCheckAt");

-- AddForeignKey
ALTER TABLE "ProjectInstallation" ADD CONSTRAINT "ProjectInstallation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
