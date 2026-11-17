-- Certificado digital por cliente e NFS-e baixadas da API de distribuição do ADN
CREATE TABLE "client_nfse_configs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "certificatePfxEncrypted" TEXT NOT NULL,
    "certificatePassphraseEncrypted" TEXT NOT NULL,
    "certificateSubject" TEXT,
    "certificateCnpj" TEXT,
    "certificateValidUntil" TIMESTAMP(3),
    "certificateUploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNsu" BIGINT NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "lastSyncCount" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "client_nfse_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_nfse_configs_clientId_key" ON "client_nfse_configs"("clientId");
CREATE INDEX "client_nfse_configs_accountingFirmId_idx" ON "client_nfse_configs"("accountingFirmId");
ALTER TABLE "client_nfse_configs" ADD CONSTRAINT "client_nfse_configs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "nfse_documents" (
    "id" TEXT NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nsu" BIGINT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "numero" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "competencia" TIMESTAMP(3),
    "valorServico" DECIMAL(14,2),
    "emitenteDoc" TEXT,
    "emitenteNome" TEXT,
    "tomadorDoc" TEXT,
    "tomadorNome" TEXT,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "eventoDescricao" TEXT,
    "xmlRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nfse_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nfse_documents_clientId_nsu_key" ON "nfse_documents"("clientId", "nsu");
CREATE INDEX "nfse_documents_accountingFirmId_idx" ON "nfse_documents"("accountingFirmId");
CREATE INDEX "nfse_documents_clientId_competencia_idx" ON "nfse_documents"("clientId", "competencia");
CREATE INDEX "nfse_documents_chaveAcesso_idx" ON "nfse_documents"("chaveAcesso");
ALTER TABLE "nfse_documents" ADD CONSTRAINT "nfse_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
