-- CreateTable
CREATE TABLE "LoginLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "permanentlyLocked" BOOLEAN NOT NULL DEFAULT false,
    "lastFailureAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" TEXT,
    CONSTRAINT "LoginLock_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LoginLock_departmentId_idx" ON "LoginLock"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginLock_scope_ip_key" ON "LoginLock"("scope", "ip");
