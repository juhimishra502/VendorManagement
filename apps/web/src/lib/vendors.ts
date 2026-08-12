import type {
  ApprovalFunction,
  CreateVendorInput,
  DocumentDTO,
  DocumentType,
  DraftOnboardingInput,
  SubmitOnboardingInput,
  VendorDetailDTO,
  VendorSummaryDTO,
} from "@vendor-management/shared";
import { apiFetch, ApiError } from "./http.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export function listVendors(): Promise<VendorSummaryDTO[]> {
  return apiFetch<VendorSummaryDTO[]>("/api/vendors");
}

export function getVendor(id: string): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}`);
}

export function createVendor(input: CreateVendorInput): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>("/api/vendors", { method: "POST", body: JSON.stringify(input) });
}

export function submitOnboarding(id: string, input: SubmitOnboardingInput): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/onboarding`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function saveOnboardingDraft(id: string, input: DraftOnboardingInput): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/onboarding/draft`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface InvitationLink {
  link: string;
  expiresAt: string;
  email: string;
}

export function sendInvitation(id: string): Promise<InvitationLink> {
  return apiFetch<InvitationLink>(`/api/vendors/${id}/invitations`, { method: "POST" });
}

export function acceptInvitation(token: string): Promise<{ vendorId: string; email: string }> {
  return apiFetch<{ vendorId: string; email: string }>("/api/onboarding/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function claimInvitation(token: string): Promise<{ vendorId: string }> {
  return apiFetch<{ vendorId: string }>("/api/onboarding/claim", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function runVerification(id: string): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/verify`, { method: "POST" });
}

export function retryErpSync(id: string): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/erp-sync`, { method: "POST" });
}

export function completeApproval(
  id: string,
  fn: ApprovalFunction,
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  notes?: string,
): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/approvals/${fn}`, {
    method: "POST",
    body: JSON.stringify({ decision, notes }),
  });
}

// --- Documents --------------------------------------------------------------

export function listDocuments(id: string): Promise<DocumentDTO[]> {
  return apiFetch<DocumentDTO[]>(`/api/vendors/${id}/documents`);
}

export function reviewDocument(
  id: string,
  docId: string,
  status: "APPROVED" | "REJECTED",
  note?: string,
): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/documents/${docId}/review`, {
    method: "POST",
    body: JSON.stringify({ status, note }),
  });
}

/** Read a File as raw Base64 (strips the data-URI prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadDocument(
  id: string,
  type: DocumentType,
  file: File,
  expiryDate?: string,
): Promise<VendorDetailDTO> {
  const dataBase64 = await fileToBase64(file);
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/documents`, {
    method: "POST",
    body: JSON.stringify({ type, fileName: file.name, mimeType: file.type, dataBase64, expiryDate: expiryDate || undefined }),
  });
}

export function upsertContact(
  id: string,
  input: { type: string; name: string; email?: string; phone?: string },
): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/contacts`, { method: "POST", body: JSON.stringify(input) });
}

export function removeContact(id: string, contactId: string): Promise<VendorDetailDTO> {
  return apiFetch<VendorDetailDTO>(`/api/vendors/${id}/contacts/${contactId}`, { method: "DELETE" });
}

/** Download a document via the API (decoded server-side) and save it locally. */
export async function downloadDocument(docId: string, fileName: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/documents/${docId}/download`, { credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, "Download failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
