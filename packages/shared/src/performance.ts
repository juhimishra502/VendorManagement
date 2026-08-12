import { z } from "zod";

// Automotive supplier scorecard: quality & delivery weighted heaviest.
export const performanceDimensions = ["quality", "delivery", "cost", "responsiveness"] as const;
export type PerformanceDimension = (typeof performanceDimensions)[number];

export const performanceWeights: Record<PerformanceDimension, number> = {
  quality: 35,
  delivery: 35,
  cost: 20,
  responsiveness: 10,
};

export const performanceDimensionLabels: Record<PerformanceDimension, string> = {
  quality: "Quality",
  delivery: "Delivery (OTIF)",
  cost: "Cost",
  responsiveness: "Responsiveness",
};

export const performanceBands = ["EXCELLENT", "GOOD", "FAIR", "AT_RISK"] as const;
export type PerformanceBand = (typeof performanceBands)[number];

export const performanceBandLabels: Record<PerformanceBand, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  AT_RISK: "At risk",
};

/** Below this overall score a vendor is flagged at-risk (drives PERFORMANCE_ISSUE alerts). */
export const performanceAtRiskThreshold = 60;

export function bandForScore(overall: number): PerformanceBand {
  if (overall >= 90) return "EXCELLENT";
  if (overall >= 75) return "GOOD";
  if (overall >= performanceAtRiskThreshold) return "FAIR";
  return "AT_RISK";
}

/** Weighted overall score. The score is ALWAYS derived from entered dimensions — never fabricated. */
export function computeOverallScore(scores: Record<PerformanceDimension, number>): number {
  const total = performanceDimensions.reduce((sum, d) => sum + scores[d] * performanceWeights[d], 0);
  return Math.round(total / 100);
}

const score0to100 = z.number().int().min(0).max(100);
const nonNegInt = z.number().int().min(0);

export const recordReviewSchema = z.object({
  // Period label, e.g. "2026-Q2" or "2026-06".
  period: z.string().trim().min(4).max(20),
  qualityScore: score0to100,
  deliveryScore: score0to100,
  costScore: score0to100,
  responsivenessScore: score0to100,
  ppm: nonNegInt.optional(),
  otifPercent: score0to100.optional(),
  incidents: nonNegInt.optional(),
  note: z.string().trim().max(1000).optional(),
});
export type RecordReviewInput = z.infer<typeof recordReviewSchema>;

export interface PerformanceReviewDTO {
  id: string;
  period: string;
  qualityScore: number;
  deliveryScore: number;
  costScore: number;
  responsivenessScore: number;
  overallScore: number;
  band: PerformanceBand;
  ppm: number | null;
  otifPercent: number | null;
  incidents: number | null;
  note: string | null;
  reviewedByName: string | null;
  createdAt: string;
}

export interface ScorecardTrendPointDTO {
  period: string;
  overallScore: number;
}

export interface ScorecardDTO {
  hasData: boolean;
  overallScore: number | null;
  band: PerformanceBand | null;
  latestPeriod: string | null;
  reviewCount: number;
  // Latest recorded value per dimension (null until a review exists).
  dimensions: Record<PerformanceDimension, number | null>;
  trend: ScorecardTrendPointDTO[];
  reviews: PerformanceReviewDTO[];
}
