-- CreateEnum
CREATE TYPE "ObligationType" AS ENUM ('PAGAMENTO', 'CADASTRAL', 'DECLARACAO', 'DOCUMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "DueDateRule" AS ENUM ('ANTECIPA', 'POSTERGA');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('PORTAL', 'EMAIL', 'FISICA');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('CONFERENCIA', 'RECONHECIDO_ROBO', 'PROTOCOLADO', 'BAIXA_JUSTIFICADA', 'AGUARDANDO_ENTREGA_FISICA');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('EM_ABERTO', 'CONCLUIDA');

-- CreateTable
CREATE TABLE "obligations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ObligationType" NOT NULL,
    "department" TEXT NOT NULL,
    "nickname" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "status" "ObligationStatus" NOT NULL DEFAULT 'ATIVO',
    "defaultRobot" BOOLEAN NOT NULL DEFAULT false,
    "physicalOnly" BOOLEAN NOT NULL DEFAULT false,
    "dueControl" BOOLEAN NOT NULL DEFAULT true,
    "internalGoalDays" INTEGER,
    "ruleMonth" INTEGER,
    "dueDay" INTEGER,
    "dueDateRule" "DueDateRule" NOT NULL DEFAULT 'ANTECIPA',
    "saturdayBusinessDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingFirmId" TEXT NOT NULL,

    CONSTRAINT "obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_groups" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingFirmId" TEXT NOT NULL,

    CONSTRAINT "obligation_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_group_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,

    CONSTRAINT "obligation_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_obligations" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "taskStatus" "TaskStatus" NOT NULL DEFAULT 'EM_ABERTO',
    "startsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "responsibleId" TEXT,

    CONSTRAINT "client_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_robots" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "identifiers" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,

    CONSTRAINT "obligation_robots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_documents" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "reference" TEXT,
    "dueDate" TIMESTAMP(3),
    "protocolDate" TIMESTAMP(3),
    "status" "ProtocolStatus" NOT NULL DEFAULT 'CONFERENCIA',
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'PORTAL',
    "robotMatched" BOOLEAN NOT NULL DEFAULT false,
    "robotIdentifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "clientId" TEXT,
    "obligationId" TEXT,
    "responsibleId" TEXT,

    CONSTRAINT "protocol_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "obligations_accountingFirmId_idx" ON "obligations"("accountingFirmId");

-- CreateIndex
CREATE INDEX "obligations_status_idx" ON "obligations"("status");

-- CreateIndex
CREATE INDEX "obligation_groups_accountingFirmId_idx" ON "obligation_groups"("accountingFirmId");

-- CreateIndex
CREATE UNIQUE INDEX "obligation_groups_accountingFirmId_nickname_key" ON "obligation_groups"("accountingFirmId", "nickname");

-- CreateIndex
CREATE INDEX "obligation_group_items_obligationId_idx" ON "obligation_group_items"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "obligation_group_items_groupId_obligationId_key" ON "obligation_group_items"("groupId", "obligationId");

-- CreateIndex
CREATE INDEX "client_obligations_obligationId_idx" ON "client_obligations"("obligationId");

-- CreateIndex
CREATE INDEX "client_obligations_responsibleId_idx" ON "client_obligations"("responsibleId");

-- CreateIndex
CREATE UNIQUE INDEX "client_obligations_clientId_obligationId_key" ON "client_obligations"("clientId", "obligationId");

-- CreateIndex
CREATE INDEX "obligation_robots_accountingFirmId_idx" ON "obligation_robots"("accountingFirmId");

-- CreateIndex
CREATE INDEX "obligation_robots_obligationId_idx" ON "obligation_robots"("obligationId");

-- CreateIndex
CREATE INDEX "protocol_documents_accountingFirmId_idx" ON "protocol_documents"("accountingFirmId");

-- CreateIndex
CREATE INDEX "protocol_documents_clientId_idx" ON "protocol_documents"("clientId");

-- CreateIndex
CREATE INDEX "protocol_documents_obligationId_idx" ON "protocol_documents"("obligationId");

-- CreateIndex
CREATE INDEX "protocol_documents_status_idx" ON "protocol_documents"("status");

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_groups" ADD CONSTRAINT "obligation_groups_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_group_items" ADD CONSTRAINT "obligation_group_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "obligation_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_group_items" ADD CONSTRAINT "obligation_group_items_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_obligations" ADD CONSTRAINT "client_obligations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_obligations" ADD CONSTRAINT "client_obligations_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_obligations" ADD CONSTRAINT "client_obligations_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_robots" ADD CONSTRAINT "obligation_robots_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_robots" ADD CONSTRAINT "obligation_robots_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_documents" ADD CONSTRAINT "protocol_documents_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_documents" ADD CONSTRAINT "protocol_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_documents" ADD CONSTRAINT "protocol_documents_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_documents" ADD CONSTRAINT "protocol_documents_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
