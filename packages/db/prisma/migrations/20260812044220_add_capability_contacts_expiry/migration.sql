-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('PRIMARY', 'FINANCE', 'QUALITY', 'COMMERCIAL', 'ESCALATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'ARTICLES_OF_INCORPORATION';
ALTER TYPE "DocumentType" ADD VALUE 'BUSINESS_LICENSE';
ALTER TYPE "DocumentType" ADD VALUE 'QUALITY_CERT';
ALTER TYPE "DocumentType" ADD VALUE 'COMPLIANCE_DOC';
ALTER TYPE "DocumentType" ADD VALUE 'INSURANCE';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "expiryDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OnboardingCase" ADD COLUMN     "annualCapacity" TEXT,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "complianceNotes" TEXT,
ADD COLUMN     "components" TEXT,
ADD COLUMN     "corporateAddress" TEXT,
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "manufacturingCapability" TEXT,
ADD COLUMN     "ownershipStructure" TEXT,
ADD COLUMN     "products" TEXT,
ADD COLUMN     "qualityCertifications" TEXT,
ADD COLUMN     "tradeName" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorContact_vendorId_idx" ON "VendorContact"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorContact_vendorId_type_key" ON "VendorContact"("vendorId", "type");

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

