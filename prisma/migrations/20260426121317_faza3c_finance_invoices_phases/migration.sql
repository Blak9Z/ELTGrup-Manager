-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('ADVANCE', 'PROGRESS', 'FINAL', 'WARRANTY_RETENTION');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "invoiceType" "InvoiceType" NOT NULL DEFAULT 'FINAL',
ADD COLUMN     "phaseId" TEXT;
