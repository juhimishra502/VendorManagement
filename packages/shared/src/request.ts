import { z } from "zod";

export const requestStatuses = ["REQUESTED", "IN_REVIEW", "SHORTLISTED", "ONBOARDING", "COMPLETED", "BLOCKED"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export const requestPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type RequestPriority = (typeof requestPriorities)[number];

export const createRequestSchema = z.object({
  vendorName: z.string().trim().min(2, "Vendor name is required").max(200),
  category: z.string().trim().max(120).optional(),
  vendorType: z.string().trim().max(120).optional(),
  priority: z.enum(requestPriorities).default("MEDIUM"),
  businessJustification: z.string().trim().min(5, "Please give a business justification").max(2000),
  businessRequirement: z.string().trim().max(2000).optional(),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const updateRequestSchema = z.object({
  status: z.enum(["IN_REVIEW", "SHORTLISTED", "BLOCKED"]),
  blockedReason: z.string().trim().max(1000).optional(),
});
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

// When Procurement converts a shortlisted request into an actual vendor.
export const requestToVendorSchema = z.object({
  contactEmail: z.string().trim().email("Enter a valid vendor contact email").optional(),
  tier: z.enum(["OEM", "TIER1", "TIER2", "TIER3"]).optional(),
});
export type RequestToVendorInput = z.infer<typeof requestToVendorSchema>;

export interface BusinessRequestDTO {
  id: string;
  vendorName: string;
  category: string | null;
  vendorType: string | null;
  priority: RequestPriority;
  businessJustification: string;
  businessRequirement: string | null;
  status: RequestStatus;
  blockedReason: string | null;
  requestedByName: string | null;
  createdAt: string;
  updatedAt: string;
  // Live view of the linked vendor (so Business can self-track without chasing Procurement).
  vendorId: string | null;
  onboardingStatus: string | null;
  progressPercent: number | null;
  currentBlocker: string | null;
  currentOwner: string | null;
  pendingAction: string | null;
  erpStatus: string | null;
  sapVendorId: string | null;
}
