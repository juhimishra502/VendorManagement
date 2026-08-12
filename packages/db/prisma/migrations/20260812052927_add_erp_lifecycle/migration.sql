-- CreateEnum
CREATE TYPE "ErpStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'SYNCED', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ERP_SYNC_FAILED';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "erpError" TEXT,
ADD COLUMN     "erpLastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "erpProvider" TEXT,
ADD COLUMN     "erpStatus" "ErpStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "erpSyncedAt" TIMESTAMP(3);

-- Backfill: vendors already handed off to SAP are marked SYNCED (bounded by WHERE).
UPDATE "Vendor"
   SET "erpStatus" = 'SYNCED', "erpProvider" = 'mock-sap-s4hana', "erpSyncedAt" = "updatedAt"
 WHERE "sapVendorId" IS NOT NULL;
