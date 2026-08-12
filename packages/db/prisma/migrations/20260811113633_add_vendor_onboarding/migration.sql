-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PROCUREMENT', 'FINANCE', 'TAX', 'LEGAL', 'QUALITY', 'VENDOR');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('DRAFT', 'ONBOARDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('CREATED', 'INFO_SUBMITTED', 'VERIFICATION_IN_PROGRESS', 'VERIFICATION_PASSED', 'VERIFICATION_FAILED', 'IN_APPROVAL', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('PAN', 'GST', 'UDYAM', 'BANK');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalFunction" AS ENUM ('FINANCE', 'TAX', 'LEGAL', 'QUALITY');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PAN_CARD', 'GST_CERTIFICATE', 'UDYAM_CERTIFICATE', 'BANK_PROOF', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'PROCUREMENT';

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT,
    "category" TEXT,
    "contactEmail" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'DRAFT',
    "sapVendorId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingCase" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'CREATED',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "pan" TEXT,
    "gstin" TEXT,
    "udyam" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "bankName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "currentBlocker" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCheck" (
    "id" TEXT NOT NULL,
    "onboardingCaseId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "reference" TEXT,
    "message" TEXT,
    "result" JSONB,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalTask" (
    "id" TEXT NOT NULL,
    "onboardingCaseId" TEXT NOT NULL,
    "function" "ApprovalFunction" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "dataBase64" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "onboardingCaseId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "Vendor_createdById_idx" ON "Vendor"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_vendorId_key" ON "OnboardingCase"("vendorId");

-- CreateIndex
CREATE INDEX "OnboardingCase_status_idx" ON "OnboardingCase"("status");

-- CreateIndex
CREATE INDEX "VerificationCheck_onboardingCaseId_idx" ON "VerificationCheck"("onboardingCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationCheck_onboardingCaseId_type_key" ON "VerificationCheck"("onboardingCaseId", "type");

-- CreateIndex
CREATE INDEX "ApprovalTask_onboardingCaseId_idx" ON "ApprovalTask"("onboardingCaseId");

-- CreateIndex
CREATE INDEX "ApprovalTask_function_status_idx" ON "ApprovalTask"("function", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalTask_onboardingCaseId_function_key" ON "ApprovalTask"("onboardingCaseId", "function");

-- CreateIndex
CREATE INDEX "Document_vendorId_idx" ON "Document"("vendorId");

-- CreateIndex
CREATE INDEX "AuditLog_vendorId_idx" ON "AuditLog"("vendorId");

-- CreateIndex
CREATE INDEX "AuditLog_onboardingCaseId_idx" ON "AuditLog"("onboardingCaseId");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCheck" ADD CONSTRAINT "VerificationCheck_onboardingCaseId_fkey" FOREIGN KEY ("onboardingCaseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_onboardingCaseId_fkey" FOREIGN KEY ("onboardingCaseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
