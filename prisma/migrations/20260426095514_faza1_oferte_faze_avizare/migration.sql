-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('OFERTARE', 'PROIECTARE', 'AVIZ_ISU', 'AVIZ_SSM', 'AVIZ_POMPIERI', 'EXECUTIE', 'RECEPTIE_PSI', 'MENTENANTA');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "ProjectPhase" ADD COLUMN     "type" "PhaseType" NOT NULL DEFAULT 'EXECUTIE';

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "notes" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "projectId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferItem" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OfferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_code_key" ON "Offer"("code");

-- CreateIndex
CREATE INDEX "Offer_status_deletedAt_idx" ON "Offer"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Offer_clientId_deletedAt_idx" ON "Offer"("clientId", "deletedAt");

-- CreateIndex
CREATE INDEX "Offer_validUntil_status_idx" ON "Offer"("validUntil", "status");

-- CreateIndex
CREATE INDEX "OfferItem_offerId_sortOrder_idx" ON "OfferItem"("offerId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectPhase_projectId_type_idx" ON "ProjectPhase"("projectId", "type");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
