-- AlterTable
ALTER TABLE "protocol_documents" ADD COLUMN     "clientNote" TEXT,
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "payDate" TIMESTAMP(3),
ADD COLUMN     "principalValue" DECIMAL(14,2),
ADD COLUMN     "protocolAs" TEXT,
ADD COLUMN     "recalculo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalValue" DECIMAL(14,2);
