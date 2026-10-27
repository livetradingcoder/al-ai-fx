-- CreateTable
CREATE TABLE "Mt5ChangeCredit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mt5ChangeCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mt5AccountChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromAccount" TEXT NOT NULL,
    "toAccount" TEXT NOT NULL,
    "creditId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mt5AccountChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mt5ChangeCredit_orderRef_key" ON "Mt5ChangeCredit"("orderRef");

-- CreateIndex
CREATE INDEX "Mt5ChangeCredit_userId_idx" ON "Mt5ChangeCredit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Mt5AccountChange_creditId_key" ON "Mt5AccountChange"("creditId");

-- CreateIndex
CREATE INDEX "Mt5AccountChange_userId_idx" ON "Mt5AccountChange"("userId");

-- AddForeignKey
ALTER TABLE "Mt5AccountChange" ADD CONSTRAINT "Mt5AccountChange_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Mt5ChangeCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
