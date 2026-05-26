-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "Zone_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Zone" ("createdAt", "departmentId", "id", "name", "orderIndex", "updatedAt") SELECT "createdAt", "departmentId", "id", "name", "orderIndex", "updatedAt" FROM "Zone";
DROP TABLE "Zone";
ALTER TABLE "new_Zone" RENAME TO "Zone";
CREATE INDEX "Zone_departmentId_orderIndex_idx" ON "Zone"("departmentId", "orderIndex");
CREATE INDEX "Zone_departmentId_active_idx" ON "Zone"("departmentId", "active");
CREATE UNIQUE INDEX "Zone_departmentId_orderIndex_key" ON "Zone"("departmentId", "orderIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
