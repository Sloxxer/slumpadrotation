-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "passwordWord" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "Zone_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "Group_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "departmentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "Person_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Person_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "departmentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "Rotation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Rotation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RotationAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rotationId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "zoneIndex" INTEGER NOT NULL,
    CONSTRAINT "RotationAssignment_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Rotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RotationAssignment_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RotationAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Zone_departmentId_orderIndex_idx" ON "Zone"("departmentId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_departmentId_orderIndex_key" ON "Zone"("departmentId", "orderIndex");

-- CreateIndex
CREATE INDEX "Group_departmentId_idx" ON "Group"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_departmentId_name_key" ON "Group"("departmentId", "name");

-- CreateIndex
CREATE INDEX "Person_departmentId_active_idx" ON "Person"("departmentId", "active");

-- CreateIndex
CREATE INDEX "Person_groupId_active_idx" ON "Person"("groupId", "active");

-- CreateIndex
CREATE INDEX "Rotation_departmentId_groupId_createdAt_idx" ON "Rotation"("departmentId", "groupId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RotationAssignment_rotationId_zoneIndex_idx" ON "RotationAssignment"("rotationId", "zoneIndex");

-- CreateIndex
CREATE INDEX "RotationAssignment_zoneId_idx" ON "RotationAssignment"("zoneId");

-- CreateIndex
CREATE INDEX "RotationAssignment_personId_idx" ON "RotationAssignment"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationAssignment_rotationId_zoneId_key" ON "RotationAssignment"("rotationId", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationAssignment_rotationId_personId_key" ON "RotationAssignment"("rotationId", "personId");
