import type {
  BusinessRequestDTO,
  CreateRequestInput,
  RequestStatus,
} from "@vendor-management/shared";
import { apiFetch } from "./http.js";

export function listRequests(): Promise<BusinessRequestDTO[]> {
  return apiFetch<BusinessRequestDTO[]>("/api/requests");
}

export function createRequest(input: CreateRequestInput): Promise<BusinessRequestDTO> {
  return apiFetch<BusinessRequestDTO>("/api/requests", { method: "POST", body: JSON.stringify(input) });
}

export function updateRequest(
  id: string,
  status: Exclude<RequestStatus, "REQUESTED" | "ONBOARDING" | "COMPLETED">,
  blockedReason?: string,
): Promise<BusinessRequestDTO> {
  return apiFetch<BusinessRequestDTO>(`/api/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, blockedReason }),
  });
}

export function convertRequest(
  id: string,
  input: { contactEmail?: string; tier?: string },
): Promise<BusinessRequestDTO> {
  return apiFetch<BusinessRequestDTO>(`/api/requests/${id}/convert`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
