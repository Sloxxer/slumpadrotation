-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "departmentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "Person_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Person_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Person" ("active", "createdAt", "departmentId", "groupId", "id", "name", "updatedAt") SELECT "active", "createdAt", "departmentId", "groupId", "id", "name", "updatedAt" FROM "Person";
DROP TABLE "Person";
ALTER TABLE "new_Person" RENAME TO "Person";
CREATE INDEX "Person_departmentId_active_idx" ON "Person"("departmentId", "active");
CREATE INDEX "Person_groupId_active_idx" ON "Person"("groupId", "active");
CREATE INDEX "Person_departmentId_archived_idx" ON "Person"("departmentId", "archived");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
