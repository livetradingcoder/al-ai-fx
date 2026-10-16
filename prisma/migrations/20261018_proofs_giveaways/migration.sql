-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GiveawayStatus" AS ENUM ('DRAFT', 'LIVE', 'DRAWN');

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "restrictedEmail" TEXT;

-- CreateTable
CREATE TABLE "ResultProof" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "displayName" TEXT,
    "publishConsent" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareProof" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resultProofId" TEXT,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "couponId" TEXT,
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "rulesText" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "GiveawayStatus" NOT NULL DEFAULT 'DRAFT',
    "winnerEntryId" TEXT,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "bonusEntries" INTEGER NOT NULL DEFAULT 0,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResultProof_sha256_key" ON "ResultProof"("sha256");

-- CreateIndex
CREATE INDEX "ResultProof_userId_createdAt_idx" ON "ResultProof"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ResultProof_status_createdAt_idx" ON "ResultProof"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ResultProof_publishedAt_idx" ON "ResultProof"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareProof_userId_key" ON "ShareProof"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareProof_couponId_key" ON "ShareProof"("couponId");

-- CreateIndex
CREATE INDEX "ShareProof_status_createdAt_idx" ON "ShareProof"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Giveaway_slug_key" ON "Giveaway"("slug");

-- CreateIndex
CREATE INDEX "Giveaway_status_endsAt_idx" ON "Giveaway"("status", "endsAt");

-- CreateIndex
CREATE INDEX "GiveawayEntry_giveawayId_createdAt_idx" ON "GiveawayEntry"("giveawayId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayEntry_giveawayId_email_key" ON "GiveawayEntry"("giveawayId", "email");

-- AddForeignKey
ALTER TABLE "ResultProof" ADD CONSTRAINT "ResultProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareProof" ADD CONSTRAINT "ShareProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareProof" ADD CONSTRAINT "ShareProof_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
