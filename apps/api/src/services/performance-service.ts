import { prisma } from "@vendor-management/db";
import {
  bandForScore,
  computeOverallScore,
  performanceAtRiskThreshold,
  type PerformanceDimension,
  type PerformanceReviewDTO,
  type RecordReviewInput,
  type ScorecardDTO,
  type UserRole,
} from "@vendor-management/shared";
import type { AuthContext } from "../middleware/auth.js";
import { ServiceError } from "./vendor-service.js";
import { notifyRole, safeNotify } from "./notification-service.js";

// Who may view scorecards vs. who may record reviews.
const INTERNAL_ROLES: UserRole[] = ["ADMIN", "PROCUREMENT", "FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"];
const REVIEWER_ROLES: UserRole[] = ["ADMIN", "PROCUREMENT", "QUALITY"];

// Minimal row shape shared by the detail include and direct queries.
export interface ReviewRow {
  id: string;
  period: string;
  qualityScore: number;
  deliveryScore: number;
  costScore: number;
  responsivenessScore: number;
  overallScore: number;
  ppm: number | null;
  otifPercent: number | null;
  incidents: number | null;
  note: string | null;
  reviewedBy?: { name: string | null } | null;
  createdAt: Date;
}

function mapReview(r: ReviewRow): PerformanceReviewDTO {
  return {
    id: r.id,
    period: r.period,
    qualityScore: r.qualityScore,
    deliveryScore: r.deliveryScore,
    costScore: r.costScore,
    responsivenessScore: r.responsivenessScore,
    overallScore: r.overallScore,
    band: bandForScore(r.overallScore),
    ppm: r.ppm,
    otifPercent: r.otifPercent,
    incidents: r.incidents,
    note: r.note,
    reviewedByName: r.reviewedBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Pure scorecard builder. The overall score and band are always derived from the
 * recorded reviews — with no reviews it returns hasData:false, never a fake score.
 */
export function buildScorecard(reviews: ReviewRow[]): ScorecardDTO {
  const asc = [...reviews].sort((a, b) => a.period.localeCompare(b.period));
  const latest = asc[asc.length - 1] ?? null;

  const dimensions: Record<PerformanceDimension, number | null> = {
    quality: latest?.qualityScore ?? null,
    delivery: latest?.deliveryScore ?? null,
    cost: latest?.costScore ?? null,
    responsiveness: latest?.responsivenessScore ?? null,
  };

  return {
    hasData: latest !== null,
    overallScore: latest?.overallScore ?? null,
    band: latest ? bandForScore(latest.overallScore) : null,
    latestPeriod: latest?.period ?? null,
    reviewCount: reviews.length,
    dimensions,
    trend: asc.map((r) => ({ period: r.period, overallScore: r.overallScore })),
    reviews: [...asc].reverse().map(mapReview),
  };
}

/** Record (or update) a vendor's performance review for a period. Reviewers only. */
export async function recordReview(
  vendorId: string,
  input: RecordReviewInput,
  actor: AuthContext,
): Promise<ScorecardDTO> {
  if (!REVIEWER_ROLES.includes(actor.role)) {
    throw new ServiceError(403, "Only procurement, quality, or admin can record performance reviews");
  }
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, legalName: true } });
  if (!vendor) throw new ServiceError(404, "Vendor not found");

  const overallScore = computeOverallScore({
    quality: input.qualityScore,
    delivery: input.deliveryScore,
    cost: input.costScore,
    responsiveness: input.responsivenessScore,
  });

  const data = {
    qualityScore: input.qualityScore,
    deliveryScore: input.deliveryScore,
    costScore: input.costScore,
    responsivenessScore: input.responsivenessScore,
    overallScore,
    ppm: input.ppm ?? null,
    otifPercent: input.otifPercent ?? null,
    incidents: input.incidents ?? null,
    note: input.note ?? null,
    reviewedById: actor.userId,
  };

  await prisma.$transaction(async (tx) => {
    await tx.performanceReview.upsert({
      where: { vendorId_period: { vendorId, period: input.period } },
      create: { vendorId, period: input.period, ...data },
      update: data,
    });
    await tx.auditLog.create({
      data: {
        vendorId,
        actorId: actor.userId,
        action: "PERFORMANCE_REVIEW_RECORDED",
        detail: { period: input.period, overallScore, band: bandForScore(overallScore), by: actor.email },
      },
    });
  });

  // Flag procurement when the latest review lands the vendor at-risk.
  if (overallScore < performanceAtRiskThreshold) {
    await safeNotify(() =>
      notifyRole("PROCUREMENT", {
        type: "PERFORMANCE_ISSUE",
        title: `Performance at risk: ${vendor.legalName}`,
        body: `${input.period} scorecard is ${overallScore}/100 (${bandForScore(overallScore)}).`,
        vendorId,
        relatedType: "performance",
      }),
    );
  }

  return getScorecard(vendorId, actor);
}

/** A vendor's full scorecard (internal only). */
export async function getScorecard(vendorId: string, actor: AuthContext): Promise<ScorecardDTO> {
  if (!INTERNAL_ROLES.includes(actor.role)) {
    throw new ServiceError(403, "Scorecards are only available to internal users");
  }
  const reviews = await prisma.performanceReview.findMany({
    where: { vendorId },
    orderBy: { period: "asc" },
    include: { reviewedBy: { select: { name: true } } },
  });
  return buildScorecard(reviews);
}

/** Count of vendors whose most recent review is below the at-risk threshold. */
export async function countPerformanceAtRisk(): Promise<number> {
  const latestPerVendor = await prisma.performanceReview.findMany({
    distinct: ["vendorId"],
    orderBy: [{ vendorId: "asc" }, { period: "desc" }],
    select: { overallScore: true },
  });
  return latestPerVendor.filter((r) => r.overallScore < performanceAtRiskThreshold).length;
}
