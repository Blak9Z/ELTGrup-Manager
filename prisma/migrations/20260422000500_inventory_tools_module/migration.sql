-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('TOOL', 'EQUIPMENT', 'CONSUMABLE', 'STOCK_ITEM');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'RESERVED', 'IN_SERVICE', 'DAMAGED', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "InventoryAssignmentStatus" AS ENUM ('ACTIVE', 'RETURNED', 'PARTIAL_RETURNED', 'LOST');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('INITIAL', 'ISSUE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'DAMAGE', 'LOSS');

-- CreateEnum
CREATE TYPE "InventoryCondition" AS ENUM ('NEW', 'GOOD', 'USED', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "InventoryInspectionType" AS ENUM ('INSPECTION', 'CALIBRATION', 'WARRANTY_CHECK', 'EXPIRY_CHECK');

-- CreateEnum
CREATE TYPE "InventoryInspectionResult" AS ENUM ('PASS', 'NEEDS_SERVICE', 'FAILED');

-- CreateTable
CREATE TABLE "InventoryCategory" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "zone" TEXT,
  "shelf" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "itemType" "InventoryItemType" NOT NULL DEFAULT 'TOOL',
  "categoryId" TEXT,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "internalCode" TEXT NOT NULL,
  "serialNumber" TEXT,
  "brand" TEXT,
  "model" TEXT,
  "unitOfMeasure" TEXT NOT NULL DEFAULT 'buc',
  "quantityTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "quantityAvailable" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "minimumStock" DECIMAL(12,2),
  "status" "InventoryItemStatus" NOT NULL DEFAULT 'AVAILABLE',
  "purchaseDate" TIMESTAMP(3),
  "warrantyUntil" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "inspectionDate" TIMESTAMP(3),
  "nextInspectionDate" TIMESTAMP(3),
  "notes" TEXT,
  "requiresReturn" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAssignment" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "projectId" TEXT,
  "issuedToUserId" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "returnedById" TEXT,
  "quantity" DECIMAL(12,2) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "conditionAtIssue" "InventoryCondition" NOT NULL DEFAULT 'GOOD',
  "conditionAtReturn" "InventoryCondition",
  "status" "InventoryAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "returnNotes" TEXT,
  "isDamaged" BOOLEAN NOT NULL DEFAULT false,
  "isLost" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "warehouseId" TEXT NOT NULL,
  "projectId" TEXT,
  "performedById" TEXT,
  "fromLocationId" TEXT,
  "toLocationId" TEXT,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryInspectionRecord" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "performedById" TEXT,
  "type" "InventoryInspectionType" NOT NULL,
  "result" "InventoryInspectionResult" NOT NULL,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextDueAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryInspectionRecord_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_quantity_non_negative"
  CHECK ("quantityTotal" >= 0 AND "quantityAvailable" >= 0);

-- AddCheckConstraint
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_available_not_above_total"
  CHECK ("quantityAvailable" <= "quantityTotal");

-- AddCheckConstraint
ALTER TABLE "InventoryAssignment"
  ADD CONSTRAINT "InventoryAssignment_quantity_positive"
  CHECK ("quantity" > 0);

-- AddCheckConstraint
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_quantity_positive"
  CHECK ("quantity" > 0);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_code_key" ON "InventoryCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_name_key" ON "InventoryCategory"("name");

-- CreateIndex
CREATE INDEX "InventoryCategory_name_isActive_idx" ON "InventoryCategory"("name", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_code_key" ON "InventoryLocation"("code");

-- CreateIndex
CREATE INDEX "InventoryLocation_warehouseId_isActive_idx" ON "InventoryLocation"("warehouseId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_internalCode_key" ON "InventoryItem"("internalCode");

-- CreateIndex
CREATE INDEX "InventoryItem_name_deletedAt_idx" ON "InventoryItem"("name", "deletedAt");

-- CreateIndex
CREATE INDEX "InventoryItem_categoryId_status_idx" ON "InventoryItem"("categoryId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_warehouseId_status_idx" ON "InventoryItem"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_status_quantityAvailable_idx" ON "InventoryItem"("status", "quantityAvailable");

-- CreateIndex
CREATE INDEX "InventoryItem_nextInspectionDate_idx" ON "InventoryItem"("nextInspectionDate");

-- CreateIndex
CREATE INDEX "InventoryItem_expiryDate_idx" ON "InventoryItem"("expiryDate");

-- CreateIndex
CREATE INDEX "InventoryItem_serialNumber_idx" ON "InventoryItem"("serialNumber");

-- CreateIndex
CREATE INDEX "InventoryAssignment_itemId_status_issuedAt_idx" ON "InventoryAssignment"("itemId", "status", "issuedAt");

-- CreateIndex
CREATE INDEX "InventoryAssignment_projectId_status_idx" ON "InventoryAssignment"("projectId", "status");

-- CreateIndex
CREATE INDEX "InventoryAssignment_issuedToUserId_status_idx" ON "InventoryAssignment"("issuedToUserId", "status");

-- CreateIndex
CREATE INDEX "InventoryAssignment_returnedAt_idx" ON "InventoryAssignment"("returnedAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_itemId_movedAt_idx" ON "InventoryMovement"("itemId", "movedAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_warehouseId_movedAt_idx" ON "InventoryMovement"("warehouseId", "movedAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_projectId_movedAt_idx" ON "InventoryMovement"("projectId", "movedAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_assignmentId_idx" ON "InventoryMovement"("assignmentId");

-- CreateIndex
CREATE INDEX "InventoryInspectionRecord_itemId_performedAt_idx" ON "InventoryInspectionRecord"("itemId", "performedAt");

-- CreateIndex
CREATE INDEX "InventoryInspectionRecord_nextDueAt_result_idx" ON "InventoryInspectionRecord"("nextDueAt", "result");

-- AddForeignKey
ALTER TABLE "InventoryLocation"
  ADD CONSTRAINT "InventoryLocation_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAssignment"
  ADD CONSTRAINT "InventoryAssignment_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAssignment"
  ADD CONSTRAINT "InventoryAssignment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAssignment"
  ADD CONSTRAINT "InventoryAssignment_issuedToUserId_fkey"
  FOREIGN KEY ("issuedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAssignment"
  ADD CONSTRAINT "InventoryAssignment_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAssignment"
  ADD CONSTRAINT "InventoryAssignment_returnedById_fkey"
  FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "InventoryAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_fromLocationId_fkey"
  FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_toLocationId_fkey"
  FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryInspectionRecord"
  ADD CONSTRAINT "InventoryInspectionRecord_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryInspectionRecord"
  ADD CONSTRAINT "InventoryInspectionRecord_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
