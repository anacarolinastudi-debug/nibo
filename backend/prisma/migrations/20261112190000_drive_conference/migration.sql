-- Conferência automática a partir de uma pasta do Google Drive
ALTER TABLE "accounting_firms" ADD COLUMN "driveConferenceFolderId" TEXT;
ALTER TABLE "accounting_firms" ADD COLUMN "driveClientsFolderId" TEXT;
ALTER TABLE "accounting_firms" ADD COLUMN "driveLastSyncAt" TIMESTAMP(3);
ALTER TABLE "accounting_firms" ADD COLUMN "driveLastSyncError" TEXT;

ALTER TABLE "protocol_documents" ADD COLUMN "sourceDriveFileId" TEXT;
ALTER TABLE "protocol_documents" ADD COLUMN "competenceYear" INTEGER;
ALTER TABLE "protocol_documents" ADD COLUMN "competenceMonth" INTEGER;
ALTER TABLE "protocol_documents" ADD COLUMN "taskYear" INTEGER;
ALTER TABLE "protocol_documents" ADD COLUMN "taskMonth" INTEGER;
ALTER TABLE "protocol_documents" ADD COLUMN "identificationNotes" TEXT;
ALTER TABLE "protocol_documents" ADD COLUMN "driveMovedAt" TIMESTAMP(3);
ALTER TABLE "protocol_documents" ADD COLUMN "driveDestination" TEXT;

CREATE UNIQUE INDEX "protocol_documents_accountingFirmId_sourceDriveFileId_key" ON "protocol_documents"("accountingFirmId", "sourceDriveFileId");
