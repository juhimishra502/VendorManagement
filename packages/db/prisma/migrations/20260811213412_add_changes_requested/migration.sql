-- Additively extend the canonical status enums to represent the
-- "request changes" workflow. No data is modified or removed.

-- AlterEnum
ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';

-- AlterEnum
ALTER TYPE "ApprovalStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
