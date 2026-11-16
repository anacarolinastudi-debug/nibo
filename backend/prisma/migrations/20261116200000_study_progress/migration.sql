-- Progresso do cronograma de estudos (aba Estudos), um registro por pessoa e plano.
CREATE TABLE "study_progress" (
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "study_progress_pkey" PRIMARY KEY ("userId", "plan")
);
