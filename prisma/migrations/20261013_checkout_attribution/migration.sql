-- CreateTable
CREATE TABLE "CheckoutAttribution" (
    "orderRef" TEXT NOT NULL,
    "fbp" TEXT,
    "fbc" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutAttribution_pkey" PRIMARY KEY ("orderRef")
);

-- CreateIndex
CREATE INDEX "CheckoutAttribution_createdAt_idx" ON "CheckoutAttribution"("createdAt");
