ALTER TABLE "protocol_documents" ADD COLUMN "demandId" TEXT;
ALTER TABLE "protocol_documents" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "protocol_documents" ADD COLUMN "emailTo" TEXT;
ALTER TABLE "protocol_documents" ADD COLUMN "emailStatus" TEXT;
ALTER TABLE "protocol_documents" ADD COLUMN "deliveryNote" TEXT;

CREATE INDEX "protocol_documents_demandId_idx" ON "protocol_documents"("demandId");

ALTER TABLE "protocol_documents"
  ADD CONSTRAINT "protocol_documents_demandId_fkey"
  FOREIGN KEY ("demandId") REFERENCES "demands"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
