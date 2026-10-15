-- CreateTable
CREATE TABLE "ResultsRequest" (
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultsRequest_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "ResultsRequest" ADD CONSTRAINT "ResultsRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

