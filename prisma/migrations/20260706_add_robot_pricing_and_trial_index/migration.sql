-- CreateTable
CREATE TABLE "RobotPrice" (
    "id" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "tier" "PricingTier" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobotPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RobotPrice_robotId_active_idx" ON "RobotPrice"("robotId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RobotPrice_robotId_tier_key" ON "RobotPrice"("robotId", "tier");

-- AddForeignKey
ALTER TABLE "RobotPrice" ADD CONSTRAINT "RobotPrice_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One free trial per robot, EVER (existence-ever, not active-ever): a partial
-- unique index. Not expressible in schema.prisma — applied as raw SQL here and
-- intentionally invisible to `migrate diff`. Do NOT let a later diff "correct" it.
CREATE UNIQUE INDEX "Subscription_one_free_trial_per_robot"
  ON "Subscription" ("userId", "robotId")
  WHERE "tier" = 'FREE_TRIAL';
