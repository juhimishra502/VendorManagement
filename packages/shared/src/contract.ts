import { z } from "zod";

export const contractStatuses = ["DRAFT", "ACTIVE", "TERMINATED", "RENEWED"] as const;
export type ContractStatus = (typeof contractStatuses)[number];

export const contractStatusLabels: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  TERMINATED: "Terminated",
  RENEWED: "Renewed",
};

export const obligationStatuses = ["PENDING", "IN_PROGRESS", "MET", "BREACHED", "WAIVED"] as const;
export type ObligationStatus = (typeof obligationStatuses)[number];

export const obligationStatusLabels: Record<ObligationStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  MET: "Met",
  BREACHED: "Breached",
  WAIVED: "Waived",
};

/** Effective display state including derived expiry (not stored). */
export type ContractDisplayStatus = ContractStatus | "EXPIRING" | "EXPIRED";

/** Sample boilerplate T&C used to pre-fill new contracts (dummy content). */
export const defaultContractTerms = `1. Scope. The Supplier shall deliver the goods and services described in the applicable purchase orders in accordance with the agreed specifications and quality standards.
2. Pricing & Payment. Prices are as quoted and firm for the contract term. Payment terms follow the Buyer's standard net terms; MSME suppliers are paid within the statutory 45-day period.
3. Quality. Deliverables must meet the Buyer's quality requirements; non-conforming goods may be rejected or reworked at the Supplier's cost.
4. Delivery. The Supplier shall meet agreed delivery schedules; repeated delays may trigger performance review.
5. Compliance. The Supplier shall comply with all applicable laws, statutory registrations (PAN/GST/Udyam), and the Buyer's supplier code of conduct.
6. Confidentiality. Each party shall protect the other's confidential information disclosed under this agreement.
7. Term & Renewal. This agreement is effective for the stated term and may renew per the renewal notice period.
8. Termination. Either party may terminate for material breach not cured within 30 days of written notice.`;

const money = z.number().nonnegative().finite();

export const createContractSchema = z.object({
  title: z.string().trim().min(2).max(160),
  contractType: z.string().trim().max(60).optional(),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  value: money.optional(),
  currency: z.string().trim().length(3).default("INR"),
  autoRenew: z.boolean().default(false),
  renewalNoticeDays: z.number().int().min(0).max(365).default(30),
  terms: z.string().trim().max(10000).optional(),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractStatusSchema = z.object({ status: z.enum(contractStatuses) });
export type UpdateContractStatusInput = z.infer<typeof updateContractStatusSchema>;

export const createObligationSchema = z.object({
  description: z.string().trim().min(2).max(500),
  dueDate: z.string().min(4).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CreateObligationInput = z.infer<typeof createObligationSchema>;

export const updateObligationSchema = z.object({ status: z.enum(obligationStatuses) });
export type UpdateObligationInput = z.infer<typeof updateObligationSchema>;

export interface ObligationDTO {
  id: string;
  contractId: string;
  description: string;
  dueDate: string | null;
  status: ObligationStatus;
  note: string | null;
  overdue: boolean;
  createdAt: string;
}

export interface ContractDTO {
  id: string;
  vendorId: string;
  vendorName: string | null;
  title: string;
  contractType: string | null;
  startDate: string;
  endDate: string;
  value: number | null;
  currency: string;
  status: ContractStatus;
  displayStatus: ContractDisplayStatus;
  autoRenew: boolean;
  renewalNoticeDays: number;
  daysToExpiry: number;
  expired: boolean;
  renewalDue: boolean;
  terms: string | null;
  createdByName: string | null;
  obligations: ObligationDTO[];
  createdAt: string;
}
