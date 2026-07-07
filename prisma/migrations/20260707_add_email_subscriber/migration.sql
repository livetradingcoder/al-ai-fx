-- CreateTable
CREATE TABLE "EmailSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'algotradingschool',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSubscriber_email_key" ON "EmailSubscriber"("email");

-- CreateIndex
CREATE INDEX "EmailSubscriber_createdAt_idx" ON "EmailSubscriber"("createdAt");
