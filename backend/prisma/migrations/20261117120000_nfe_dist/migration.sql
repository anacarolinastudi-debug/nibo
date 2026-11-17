-- NF-e recebidas pela distribuição de DF-e da SEFAZ
ALTER TABLE "client_nfse_configs" ADD COLUMN "nfeLastNsu" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "client_nfse_configs" ADD COLUMN "nfeLastSyncAt" TIMESTAMP(3);
ALTER TABLE "client_nfse_configs" ADD COLUMN "nfeLastSyncStatus" TEXT;
ALTER TABLE "client_nfse_configs" ADD COLUMN "nfeLastSyncError" TEXT;
ALTER TABLE "client_nfse_configs" ADD COLUMN "nfeLastSyncCount" INTEGER;
ALTER TABLE "client_nfse_configs" ADD COLUMN "nfeNextAllowedAt" TIMESTAMP(3);

CREATE TABLE "nfe_documents" (
    "id" TEXT NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nsu" BIGINT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "numero" TEXT,
    "serie" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "valorTotal" DECIMAL(14,2),
    "emitenteDoc" TEXT,
    "emitenteNome" TEXT,
    "destinatarioDoc" TEXT,
    "destinatarioNome" TEXT,
    "situacao" TEXT,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "ciencia" TEXT,
    "cienciaErro" TEXT,
    "eventoDescricao" TEXT,
    "xmlRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nfe_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nfe_documents_clientId_nsu_key" ON "nfe_documents"("clientId", "nsu");
CREATE INDEX "nfe_documents_accountingFirmId_idx" ON "nfe_documents"("accountingFirmId");
CREATE INDEX "nfe_documents_clientId_dataEmissao_idx" ON "nfe_documents"("clientId", "dataEmissao");
CREATE INDEX "nfe_documents_chaveAcesso_idx" ON "nfe_documents"("chaveAcesso");
ALTER TABLE "nfe_documents" ADD CONSTRAINT "nfe_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
