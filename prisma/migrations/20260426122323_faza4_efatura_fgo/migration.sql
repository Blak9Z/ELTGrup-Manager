/*
  Warnings:

  - You are about to drop the column `sentAt` on the `Invoice` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FgoInvoiceStatus" AS ENUM ('DRAFT_UPLOADED', 'PENDING_VALIDATION', 'VALIDATION_OK', 'VALIDATION_ERRORS', 'SENT_TO_ANAF', 'SIGNED', 'SUBMITTED_OK', 'SUBMITTED_ERRORS', 'REJECTED');

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "sentAt",
ADD COLUMN     "fgoErrorCode" TEXT,
ADD COLUMN     "fgoRespondedAt" TIMESTAMP(3),
ADD COLUMN     "fgoSentAt" TIMESTAMP(3),
ADD COLUMN     "fgoStatus" "FgoInvoiceStatus",
ADD COLUMN     "fgoTrackingId" TEXT;
