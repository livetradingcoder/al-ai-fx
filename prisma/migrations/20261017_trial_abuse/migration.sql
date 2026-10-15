-- CreateTable
CREATE TABLE "Mt5AccountUse" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mt5AccountUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "country" TEXT,
    "source" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mt5AccountUse_accountNumber_idx" ON "Mt5AccountUse"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Mt5AccountUse_subscriptionId_accountNumber_key" ON "Mt5AccountUse"("subscriptionId", "accountNumber");

-- CreateIndex
CREATE INDEX "UserIp_ip_idx" ON "UserIp"("ip");

-- CreateIndex
CREATE INDEX "UserIp_lastSeenAt_idx" ON "UserIp"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserIp_userId_ip_key" ON "UserIp"("userId", "ip");

-- AddForeignKey
ALTER TABLE "UserIp" ADD CONSTRAINT "UserIp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every MT5 account already linked to a licence counts as used, so
-- the free-trial rule starts with the full history, not from today.
INSERT INTO "Mt5AccountUse" ("id", "accountNumber", "userId", "subscriptionId", "tier", "createdAt")
SELECT 'bf_' || md5(s."id" || ':' || btrim(s."mt5AccountNumber")),
       btrim(s."mt5AccountNumber"),
       s."userId",
       s."id",
       s."tier"::text,
       s."createdAt"
FROM "Subscription" s
WHERE s."mt5AccountNumber" IS NOT NULL AND btrim(s."mt5AccountNumber") <> ''
ON CONFLICT DO NOTHING;

-- Backfill: the addresses people have already signed in from, so the admin view
-- has history from day one. The country is filled in afterwards by the
-- housekeeping job, which has the lookup database.
INSERT INTO "UserIp" ("id", "userId", "ip", "source", "hits", "firstSeenAt", "lastSeenAt")
SELECT 'bf_' || md5(x."userId" || ':' || x."ip"),
       x."userId",
       x."ip",
       'login',
       x."hits",
       x."firstSeenAt",
       x."lastSeenAt"
FROM (
  SELECT "userId",
         btrim("ip") AS "ip",
         COUNT(*)::int AS "hits",
         MIN("createdAt") AS "firstSeenAt",
         MAX("lastSeenAt") AS "lastSeenAt"
  FROM "UserSession"
  WHERE "ip" IS NOT NULL AND btrim("ip") <> ''
  GROUP BY "userId", btrim("ip")
) x
ON CONFLICT DO NOTHING;
