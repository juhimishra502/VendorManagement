-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('REQUESTED', 'IN_REVIEW', 'SHORTLISTED', 'ONBOARDING', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'IT_SECURITY';
ALTER TYPE "UserRole" ADD VALUE 'BUSINESS';

-- CreateTable
CREATE TABLE "BusinessRequest" (
    "id" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "category" TEXT,
    "vendorType" TEXT,
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "businessJustification" TEXT NOT NULL,
    "businessRequirement" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "blockedReason" TEXT,
    "requestedById" TEXT NOT NULL,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessRequest_vendorId_key" ON "BusinessRequest"("vendorId");

-- CreateIndex
CREATE INDEX "BusinessRequest_status_idx" ON "BusinessRequest"("status");

-- CreateIndex
CREATE INDEX "BusinessRequest_requestedById_idx" ON "BusinessRequest"("requestedById");

-- AddForeignKey
ALTER TABLE "BusinessRequest" ADD CONSTRAINT "BusinessRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRequest" ADD CONSTRAINT "BusinessRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

