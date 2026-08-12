-- CreateEnum
CREATE TYPE "SupplierTier" AS ENUM ('OEM', 'TIER1', 'TIER2', 'TIER3');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('SENT', 'OPENED', 'EXPIRED', 'REVOKED');

-- AlterEnum
ALTER TYPE "OnboardingStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "tier" "SupplierTier";

-- CreateTable
CREATE TABLE "VendorInvitation" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'SENT',
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sentById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorInvitation_tokenHash_key" ON "VendorInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "VendorInvitation_vendorId_idx" ON "VendorInvitation"("vendorId");

-- CreateIndex
CREATE INDEX "VendorInvitation_status_idx" ON "VendorInvitation"("status");

-- AddForeignKey
ALTER TABLE "VendorInvitation" ADD CONSTRAINT "VendorInvitation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvitation" ADD CONSTRAINT "VendorInvitation_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

