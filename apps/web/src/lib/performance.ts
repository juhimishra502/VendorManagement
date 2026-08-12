import type { RecordReviewInput, ScorecardDTO } from "@vendor-management/shared";
import { apiFetch } from "./http.js";

export function getScorecard(vendorId: string): Promise<ScorecardDTO> {
  return apiFetch<ScorecardDTO>(`/api/vendors/${vendorId}/scorecard`);
}

export function recordReview(vendorId: string, input: RecordReviewInput): Promise<ScorecardDTO> {
  return apiFetch<ScorecardDTO>(`/api/vendors/${vendorId}/performance-reviews`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
