-- CreateTable
CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "deliveryScore" INTEGER NOT NULL,
    "costScore" INTEGER NOT NULL,
    "responsivenessScore" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "ppm" INTEGER,
    "otifPercent" INTEGER,
    "incidents" INTEGER,
    "note" TEXT,
    "reviewedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceReview_vendorId_idx" ON "PerformanceReview"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceReview_vendorId_period_key" ON "PerformanceReview"("vendorId", "period");

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
