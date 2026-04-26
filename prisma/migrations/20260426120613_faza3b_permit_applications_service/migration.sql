-- CreateEnum
CREATE TYPE "PermitType" AS ENUM ('AVIZ_ISU', 'AVIZ_SSM', 'AVIZ_POMPIERI', 'RECEPTIE_PSI');

-- CreateEnum
CREATE TYPE "PermitApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTIONS_NEEDED', 'RESUBMITTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PermitApplication" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "PermitType" NOT NULL,
    "status" "PermitApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermitApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermitApplication_projectId_type_status_idx" ON "PermitApplication"("projectId", "type", "status");

-- AddForeignKey
ALTER TABLE "PermitApplication" ADD CONSTRAINT "PermitApplication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
