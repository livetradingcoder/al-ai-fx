-- AlterTable
ALTER TABLE "EmailSubscriber" ADD COLUMN     "locale" TEXT,
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);
