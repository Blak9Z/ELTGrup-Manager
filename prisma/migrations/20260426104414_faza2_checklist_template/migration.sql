-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('PSI', 'ELECTRIC', 'BMS', 'GENERAL');

-- AlterTable
ALTER TABLE "TaskChecklistItem" ADD COLUMN     "category" "ChecklistCategory";

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ChecklistCategory" NOT NULL DEFAULT 'GENERAL',
    "items" TEXT[],
    "projectType" "ProjectType",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTemplate_category_projectType_idx" ON "ChecklistTemplate"("category", "projectType");
