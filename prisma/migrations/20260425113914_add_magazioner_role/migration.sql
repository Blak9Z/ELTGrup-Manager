-- AlterEnum
ALTER TYPE "RoleKey" ADD VALUE 'MAGAZIONER';

-- DropIndex
DROP INDEX "Project_clientId_idx";

-- DropIndex
DROP INDEX "Project_startDate_endDate_idx";

-- DropIndex
DROP INDEX "Project_status_managerId_idx";

-- DropIndex
DROP INDEX "Team_region_idx";

-- DropIndex
DROP INDEX "User_createdAt_idx";

-- DropIndex
DROP INDEX "User_email_isActive_idx";

-- DropIndex
DROP INDEX "WorkOrder_dueDate_priority_idx";

-- DropIndex
DROP INDEX "WorkOrder_projectId_status_idx";

-- DropIndex
DROP INDEX "WorkOrder_teamId_startDate_idx";

-- CreateIndex
CREATE INDEX "Project_status_managerId_deletedAt_idx" ON "Project"("status", "managerId", "deletedAt");

-- CreateIndex
CREATE INDEX "Project_startDate_endDate_deletedAt_idx" ON "Project"("startDate", "endDate", "deletedAt");

-- CreateIndex
CREATE INDEX "Project_clientId_deletedAt_idx" ON "Project"("clientId", "deletedAt");

-- CreateIndex
CREATE INDEX "Team_region_deletedAt_idx" ON "Team"("region", "deletedAt");

-- CreateIndex
CREATE INDEX "User_email_isActive_deletedAt_idx" ON "User"("email", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "User_createdAt_deletedAt_idx" ON "User"("createdAt", "deletedAt");

-- CreateIndex
CREATE INDEX "WorkOrder_teamId_startDate_deletedAt_idx" ON "WorkOrder"("teamId", "startDate", "deletedAt");

-- CreateIndex
CREATE INDEX "WorkOrder_dueDate_priority_deletedAt_idx" ON "WorkOrder"("dueDate", "priority", "deletedAt");

-- CreateIndex
CREATE INDEX "WorkOrder_projectId_status_deletedAt_idx" ON "WorkOrder"("projectId", "status", "deletedAt");
