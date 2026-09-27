-- AlterTable
ALTER TABLE "Rotation" ADD COLUMN "liveSchedule" TEXT;

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "WorkSchedule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleBreak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "scheduleId" TEXT NOT NULL,
    CONSTRAINT "ScheduleBreak_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "passwordWord" TEXT NOT NULL,
    "liveMode" TEXT NOT NULL DEFAULT 'off',
    "rotationIntervalMin" INTEGER NOT NULL DEFAULT 20,
    "minPassMin" INTEGER NOT NULL DEFAULT 5,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Department" ("archived", "archivedAt", "createdAt", "id", "name", "passwordWord", "updatedAt") SELECT "archived", "archivedAt", "createdAt", "id", "name", "passwordWord", "updatedAt" FROM "Department";
DROP TABLE "Department";
ALTER TABLE "new_Department" RENAME TO "Department";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WorkSchedule_departmentId_idx" ON "WorkSchedule"("departmentId");

-- CreateIndex
CREATE INDEX "ScheduleBreak_scheduleId_idx" ON "ScheduleBreak"("scheduleId");
