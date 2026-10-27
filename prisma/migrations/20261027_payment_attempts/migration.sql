-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderRef" TEXT,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "robotSlug" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "couponCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_orderRef_key" ON "PaymentAttempt"("orderRef");

-- CreateIndex
CREATE INDEX "PaymentAttempt_createdAt_idx" ON "PaymentAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_email_idx" ON "PaymentAttempt"("email");
