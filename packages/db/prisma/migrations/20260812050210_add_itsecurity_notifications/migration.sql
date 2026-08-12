-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPROVAL_PENDING', 'VENDOR_ACTION_REQUIRED', 'DOCUMENT_REJECTED', 'VERIFICATION_FAILED', 'SLA_APPROACHING', 'SLA_BREACHED', 'CONTRACT_RENEWAL', 'PERFORMANCE_ISSUE', 'FINANCE_EXCEPTION', 'REMINDER');

-- AlterEnum
ALTER TYPE "ApprovalFunction" ADD VALUE 'IT_SECURITY';

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "vendorId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_vendorId_idx" ON "Notification"("vendorId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

