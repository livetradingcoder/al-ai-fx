-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "polarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whopEnabled" BOOLEAN NOT NULL DEFAULT true,
    "oxapayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);
