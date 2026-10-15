-- CreateTable
CREATE TABLE "Mt5Reminder" (
    "subscriptionId" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),

    CONSTRAINT "Mt5Reminder_pkey" PRIMARY KEY ("subscriptionId")
);

-- CreateTable
CREATE TABLE "ReminderOptOut" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderOptOut_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Mt5Reminder" ADD CONSTRAINT "Mt5Reminder_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderOptOut" ADD CONSTRAINT "ReminderOptOut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

