-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "responsibleId" TEXT,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_department_responsibles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "responsibleId" TEXT,

    CONSTRAINT "client_department_responsibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firm_roles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "firm_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_accountingFirmId_idx" ON "departments"("accountingFirmId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_accountingFirmId_name_key" ON "departments"("accountingFirmId", "name");

-- CreateIndex
CREATE INDEX "client_department_responsibles_clientId_idx" ON "client_department_responsibles"("clientId");

-- CreateIndex
CREATE INDEX "client_department_responsibles_departmentId_idx" ON "client_department_responsibles"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "client_department_responsibles_clientId_departmentId_key" ON "client_department_responsibles"("clientId", "departmentId");

-- CreateIndex
CREATE INDEX "firm_roles_accountingFirmId_idx" ON "firm_roles"("accountingFirmId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_department_responsibles" ADD CONSTRAINT "client_department_responsibles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_department_responsibles" ADD CONSTRAINT "client_department_responsibles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_department_responsibles" ADD CONSTRAINT "client_department_responsibles_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firm_roles" ADD CONSTRAINT "firm_roles_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firm_roles" ADD CONSTRAINT "firm_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
