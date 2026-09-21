-- Free-trial abuse limits: per-IP cooldown and a global monthly cap.
CREATE TABLE "TrialClaim" (
    "id" TEXT NOT NULL,
    "robotSlug" TEXT NOT NULL,
    "ipHash" TEXT,
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrialClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrialClaim_ipHash_createdAt_idx" ON "TrialClaim"("ipHash", "createdAt");
CREATE INDEX "TrialClaim_createdAt_idx" ON "TrialClaim"("createdAt");
