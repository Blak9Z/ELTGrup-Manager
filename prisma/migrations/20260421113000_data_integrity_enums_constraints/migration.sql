-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('COMPANY', 'INDIVIDUAL', 'PUBLIC_INSTITUTION', 'NGO', 'OTHER');

-- CreateEnum
CREATE TYPE "SubcontractorApprovalStatus" AS ENUM ('IN_VERIFICARE', 'APROBAT', 'RESPINS', 'SUSPENDAT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PLANIFICAT', 'ACTIV', 'INTRERUPT', 'FINALIZAT', 'ANULAT');

-- Normalize free-text values before enum casts (backward compatibility).
UPDATE "Client"
SET "type" = CASE
  WHEN "type" IS NULL THEN 'COMPANY'
  WHEN UPPER(TRIM("type")) IN ('COMPANY', 'COMPANIE', 'FIRMA', 'ORGANIZATION', 'BUSINESS', 'B2B', 'LEGAL_ENTITY', 'CORPORATE') THEN 'COMPANY'
  WHEN UPPER(TRIM("type")) IN ('INDIVIDUAL', 'PERSON', 'PERSOANA_FIZICA', 'PF', 'B2C') THEN 'INDIVIDUAL'
  WHEN UPPER(TRIM("type")) IN ('PUBLIC_INSTITUTION', 'INSTITUTIE_PUBLICA', 'INSTITUTIE', 'PUBLIC') THEN 'PUBLIC_INSTITUTION'
  WHEN UPPER(TRIM("type")) IN ('NGO', 'NON_PROFIT', 'ASOCIATIE', 'FUNDATIE') THEN 'NGO'
  ELSE 'OTHER'
END;

UPDATE "Subcontractor"
SET "approvalStatus" = CASE
  WHEN "approvalStatus" IS NULL THEN 'IN_VERIFICARE'
  WHEN UPPER(TRIM("approvalStatus")) IN ('IN_VERIFICARE', 'PENDING', 'PENDING_APPROVAL', 'IN_REVIEW', 'VERIFICARE') THEN 'IN_VERIFICARE'
  WHEN UPPER(TRIM("approvalStatus")) IN ('APROBAT', 'APPROVED', 'VALIDAT', 'ACTIVE') THEN 'APROBAT'
  WHEN UPPER(TRIM("approvalStatus")) IN ('RESPINS', 'REJECTED', 'INVALID', 'DENIED') THEN 'RESPINS'
  WHEN UPPER(TRIM("approvalStatus")) IN ('SUSPENDAT', 'SUSPENDED', 'ON_HOLD', 'BLOCAT') THEN 'SUSPENDAT'
  ELSE 'IN_VERIFICARE'
END;

UPDATE "SubcontractorAssignment"
SET "status" = CASE
  WHEN "status" IS NULL THEN 'ACTIV'
  WHEN UPPER(TRIM("status")) IN ('PLANIFICAT', 'PLANNED', 'SCHEDULED') THEN 'PLANIFICAT'
  WHEN UPPER(TRIM("status")) IN ('ACTIV', 'ACTIVE', 'IN_PROGRESS', 'EXECUTIE') THEN 'ACTIV'
  WHEN UPPER(TRIM("status")) IN ('INTRERUPT', 'PAUSED', 'ON_HOLD', 'BLOCAT') THEN 'INTRERUPT'
  WHEN UPPER(TRIM("status")) IN ('FINALIZAT', 'FINALIZED', 'DONE', 'COMPLETED') THEN 'FINALIZAT'
  WHEN UPPER(TRIM("status")) IN ('ANULAT', 'CANCELED', 'CANCELLED', 'VOID') THEN 'ANULAT'
  ELSE 'ACTIV'
END;

-- AlterTable
ALTER TABLE "Client"
  ALTER COLUMN "type" SET DEFAULT 'COMPANY',
  ALTER COLUMN "type" TYPE "ClientType" USING ("type"::"ClientType");

-- AlterTable
ALTER TABLE "Subcontractor"
  ALTER COLUMN "approvalStatus" SET DEFAULT 'IN_VERIFICARE',
  ALTER COLUMN "approvalStatus" TYPE "SubcontractorApprovalStatus" USING ("approvalStatus"::"SubcontractorApprovalStatus");

-- AlterTable
ALTER TABLE "SubcontractorAssignment"
  ALTER COLUMN "status" SET DEFAULT 'ACTIV',
  ALTER COLUMN "status" TYPE "AssignmentStatus" USING ("status"::"AssignmentStatus");

-- Clamp out-of-range project progress and enforce DB-level bounds.
UPDATE "Project"
SET "progressPercent" = LEAST(100, GREATEST(0, COALESCE("progressPercent", 0)));

-- AddCheckConstraint
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_progressPercent_between_0_100"
  CHECK ("progressPercent" >= 0 AND "progressPercent" <= 100);

-- CreateIndex
CREATE INDEX "Client_type_deletedAt_idx" ON "Client"("type", "deletedAt");

-- CreateIndex
CREATE INDEX "Subcontractor_approvalStatus_deletedAt_idx" ON "Subcontractor"("approvalStatus", "deletedAt");

-- CreateIndex
CREATE INDEX "SubcontractorAssignment_status_startDate_idx" ON "SubcontractorAssignment"("status", "startDate");
