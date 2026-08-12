import type {
  ActivityFeedItemDTO,
  ApprovalQueueItemDTO,
  ProcurementMetricsDTO,
} from "@vendor-management/shared";
import { apiFetch } from "./http.js";

export function getMetrics(): Promise<ProcurementMetricsDTO> {
  return apiFetch<ProcurementMetricsDTO>("/api/metrics");
}

export type ApprovalScope = "pending" | "completed" | "changes" | "all";

export function listApprovalQueue(scope: ApprovalScope): Promise<ApprovalQueueItemDTO[]> {
  return apiFetch<ApprovalQueueItemDTO[]>(`/api/approvals?scope=${scope}`);
}

export function getActivity(limit = 100): Promise<ActivityFeedItemDTO[]> {
  return apiFetch<ActivityFeedItemDTO[]>(`/api/activity?limit=${limit}`);
}
