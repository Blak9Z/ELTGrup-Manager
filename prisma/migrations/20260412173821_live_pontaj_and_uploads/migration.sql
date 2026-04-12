-- CreateEnum
CREATE TYPE "TimeEntryLiveState" AS ENUM ('STOPPED', 'RUNNING', 'PAUSED');

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "liveState" "TimeEntryLiveState" NOT NULL DEFAULT 'STOPPED',
ADD COLUMN     "pauseAccumulatedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pausedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TimeEntry_userId_liveState_endAt_idx" ON "TimeEntry"("userId", "liveState", "endAt");
