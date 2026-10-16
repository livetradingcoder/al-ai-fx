-- CreateTable
CREATE TABLE "PromoBanner" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "couponCode" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoBanner_active_endsAt_idx" ON "PromoBanner"("active", "endsAt");
