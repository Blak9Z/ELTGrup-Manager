-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('PROJECT', 'SERVICE_CALL', 'ADMINISTRATIVE');

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "type" "WorkOrderType" NOT NULL DEFAULT 'PROJECT';
