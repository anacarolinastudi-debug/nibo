CREATE TABLE "password_reset_requests" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "accountingFirmId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_requests_accountingFirmId_idx" ON "password_reset_requests"("accountingFirmId");
CREATE INDEX "password_reset_requests_userId_idx" ON "password_reset_requests"("userId");
CREATE INDEX "password_reset_requests_email_idx" ON "password_reset_requests"("email");

ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
