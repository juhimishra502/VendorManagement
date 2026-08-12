import { z } from "zod";
import type { SlaStatus, SlaSummaryDTO } from "./notification.js";
import type { ScorecardDTO } from "./performance.js";

// ---------------------------------------------------------------------------
// Enumerations (kept in sync with the Prisma schema)
// ---------------------------------------------------------------------------

export const userRoles = [
  "ADMIN",
  "PROCUREMENT",
  "FINANCE",
  "TAX",
  "LEGAL",
  "QUALITY",
  "IT_SECURITY",
  "BUSINESS",
  "VENDOR",
] as const;
export type UserRole = (typeof userRoles)[number];

export const vendorStatuses = ["DRAFT", "ONBOARDING", "VERIFIED", "REJECTED"] as const;
export type VendorStatus = (typeof vendorStatuses)[number];

export const supplierTiers = ["OEM", "TIER1", "TIER2", "TIER3"] as const;
export type SupplierTier = (typeof supplierTiers)[number];

export const supplierTierLabels: Record<SupplierTier, string> = {
  OEM: "OEM",
  TIER1: "Tier 1",
  TIER2: "Tier 2",
  TIER3: "Tier 3",
};

export const invitationStatuses = ["SENT", "OPENED", "EXPIRED", "REVOKED"] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];

// ERP / SAP vendor-master handoff lifecycle
export const erpStatuses = ["NOT_STARTED", "PENDING", "SYNCED", "FAILED"] as const;
export type ErpStatus = (typeof erpStatuses)[number];

export const erpStatusLabels: Record<ErpStatus, string> = {
  NOT_STARTED: "Not started",
  PENDING: "Sync in progress",
  SYNCED: "Synced to SAP",
  FAILED: "Sync failed",
};

export interface ErpSummaryDTO {
  status: ErpStatus;
  provider: string | null;
  sapVendorId: string | null;
  syncedAt: string | null;
  lastAttemptAt: string | null;
  error: string | null;
}

export const onboardingStatuses = [
  "CREATED",
  "IN_PROGRESS",
  "INFO_SUBMITTED",
  "VERIFICATION_IN_PROGRESS",
  "VERIFICATION_PASSED",
  "VERIFICATION_FAILED",
  "IN_APPROVAL",
  "CHANGES_REQUESTED",
  "VERIFIED",
  "REJECTED",
] as const;
export type OnboardingStatus = (typeof onboardingStatuses)[number];

export const verificationTypes = ["PAN", "GST", "UDYAM", "BANK"] as const;
export type VerificationType = (typeof verificationTypes)[number];

export const verificationStatuses = ["PENDING", "PASSED", "FAILED"] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export const approvalFunctions = ["FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"] as const;
export type ApprovalFunction = (typeof approvalFunctions)[number];

export const approvalFunctionLabels: Record<ApprovalFunction, string> = {
  FINANCE: "Finance",
  TAX: "Tax",
  LEGAL: "Legal",
  QUALITY: "Quality",
  IT_SECURITY: "IT / Security",
};

export const approvalStatuses = ["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const documentTypes = [
  "PAN_CARD",
  "GST_CERTIFICATE",
  "UDYAM_CERTIFICATE",
  "BANK_PROOF",
  "ARTICLES_OF_INCORPORATION",
  "BUSINESS_LICENSE",
  "QUALITY_CERT",
  "COMPLIANCE_DOC",
  "INSURANCE",
  "OTHER",
] as const;
export type DocumentType = (typeof documentTypes)[number];

export const contactTypes = ["PRIMARY", "FINANCE", "QUALITY", "COMMERCIAL", "ESCALATION"] as const;
export type ContactType = (typeof contactTypes)[number];

export const contactTypeLabels: Record<ContactType, string> = {
  PRIMARY: "Primary contact",
  FINANCE: "Finance contact",
  QUALITY: "Quality contact",
  COMMERCIAL: "Commercial contact",
  ESCALATION: "Escalation contact",
};

export const documentExpiryStates = ["VALID", "EXPIRING_SOON", "EXPIRED", "NONE"] as const;
export type DocumentExpiryState = (typeof documentExpiryStates)[number];

// The documents a vendor must upload to complete onboarding (OTHER is optional).
export const requiredDocumentTypes = ["PAN_CARD", "GST_CERTIFICATE", "UDYAM_CERTIFICATE", "BANK_PROOF"] as const;

export const documentStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

export const documentTypeLabels: Record<DocumentType, string> = {
  PAN_CARD: "PAN card",
  GST_CERTIFICATE: "GST certificate",
  UDYAM_CERTIFICATE: "Udyam certificate",
  BANK_PROOF: "Bank proof (cancelled cheque / statement)",
  ARTICLES_OF_INCORPORATION: "Articles of incorporation",
  BUSINESS_LICENSE: "Business license",
  QUALITY_CERT: "Quality certification (IATF / ISO)",
  COMPLIANCE_DOC: "Compliance document",
  INSURANCE: "Insurance certificate",
  OTHER: "Other supporting document",
};

// Accepted upload MIME types (binary is stored as Base64 in Neon, capped at 1 MB).
export const allowedDocumentMimeTypes = ["application/pdf", "image/png", "image/jpeg"] as const;
export const maxDocumentBytes = 1024 * 1024; // 1 MB original binary

// ---------------------------------------------------------------------------
// Request validation schemas
// ---------------------------------------------------------------------------

export const createVendorSchema = z.object({
  legalName: z.string().trim().min(2, "Legal name is required").max(200),
  displayName: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  tier: z.enum(supplierTiers).optional(),
  contactEmail: z.string().trim().email("Enter a valid email").optional(),
});
export type CreateVendorInput = z.infer<typeof createVendorSchema>;

export const submitOnboardingSchema = z.object({
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email("Enter a valid email"),
  contactPhone: z.string().trim().min(5).max(20).optional(),
  addressLine1: z.string().trim().min(2).max(200),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(120).default("India"),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must look like ABCDE1234F"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/, "GSTIN must be 15 characters"),
  udyam: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/, "Udyam must look like UDYAM-KA-00-0000000"),
  bankAccountName: z.string().trim().min(2).max(120),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,18}$/, "Account number must be 6-18 digits"),
  bankIfsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[0-9A-Z]{6}$/, "IFSC must look like HDFC0001234"),
  bankName: z.string().trim().min(2).max(120),
  // Business / capability profile (optional — supplements the mandatory sections).
  tradeName: z.string().trim().max(200).optional(),
  website: z.string().trim().max(200).optional(),
  corporateAddress: z.string().trim().max(300).optional(),
  businessType: z.string().trim().max(120).optional(),
  ownershipStructure: z.string().trim().max(120).optional(),
  products: z.string().trim().max(500).optional(),
  components: z.string().trim().max(500).optional(),
  manufacturingCapability: z.string().trim().max(500).optional(),
  annualCapacity: z.string().trim().max(120).optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(3650).optional(),
  qualityCertifications: z.string().trim().max(300).optional(),
  complianceNotes: z.string().trim().max(500).optional(),
});
export type SubmitOnboardingInput = z.infer<typeof submitOnboardingSchema>;

// Lenient partial save (save & resume): any subset of fields, each still format-checked if present.
export const draftOnboardingSchema = submitOnboardingSchema.partial();
export type DraftOnboardingInput = z.infer<typeof draftOnboardingSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(16, "Invalid invitation token"),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const approvalDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.decision !== "CHANGES_REQUESTED" || (d.notes?.length ?? 0) > 0, {
    message: "A reason is required to request changes",
    path: ["notes"],
  });
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;

export const uploadDocumentSchema = z.object({
  type: z.enum(documentTypes),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(allowedDocumentMimeTypes),
  // Raw Base64 (a leading `data:...;base64,` prefix is stripped server-side).
  dataBase64: z.string().min(1, "File data is required"),
  expiryDate: z.string().trim().optional(), // ISO date; optional for non-expiring docs
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const vendorContactSchema = z.object({
  type: z.enum(contactTypes),
  name: z.string().trim().min(2, "Contact name is required").max(120),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});
export type VendorContactInput = z.infer<typeof vendorContactSchema>;

export const reviewDocumentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(1000).optional(),
});
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;

// Dev-only: assign a role to an existing user (never exposed in production).
export const assignRoleSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(userRoles),
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

export interface DevUserDTO {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Response DTOs (what the REST API returns to the browser)
// ---------------------------------------------------------------------------

export interface VerificationCheckDTO {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  provider: string;
  reference: string | null;
  message: string | null;
  checkedAt: string | null;
}

export interface ApprovalTaskDTO {
  id: string;
  function: ApprovalFunction;
  status: ApprovalStatus;
  decidedByName: string | null;
  decidedAt: string | null;
  notes: string | null;
}

export interface InvitationDTO {
  id: string;
  status: InvitationStatus;
  email: string;
  expiresAt: string;
  openedAt: string | null;
  createdAt: string;
  expired: boolean;
}

export interface VendorSummaryDTO {
  id: string;
  legalName: string;
  displayName: string | null;
  category: string | null;
  tier: SupplierTier | null;
  progressPercent: number;
  status: VendorStatus;
  onboardingStatus: OnboardingStatus | null;
  sapVendorId: string | null;
  completedChecks: number;
  totalChecks: number;
  completedApprovals: number;
  totalApprovals: number;
  requiredDocsUploaded: number;
  requiredDocsTotal: number;
  pendingActions: string;
  currentBlocker: string | null;
  responsibleFunction: string | null;
  slaStatus: SlaStatus;
  onboardingAgeDays: number;
  erpStatus: ErpStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Procurement control tower + approver workspace DTOs
// ---------------------------------------------------------------------------

export interface PipelineStageDTO {
  stage: string;
  label: string;
  count: number;
}

export interface ProcurementMetricsDTO {
  totalVendors: number;
  inOnboarding: number;
  awaitingVendor: number;
  verificationPending: number;
  verificationFailed: number;
  approvalPending: number;
  verified: number;
  slaAtRisk: number;
  reworkRate: number;
  erpPending: number;
  erpFailed: number;
  erpSynced: number;
  performanceAtRisk: number;
  pipeline: PipelineStageDTO[];
}

// Per-function review SLA in days (from the mock: Finance/Legal 3d, Quality 5d;
// Tax mirrors the other statutory reviews at 3d). Used for queue transparency only.
export const approvalSlaDays: Record<ApprovalFunction, number> = {
  FINANCE: 3,
  TAX: 3,
  LEGAL: 3,
  QUALITY: 5,
  IT_SECURITY: 4,
};

/** Target elapsed days for the whole onboarding, used for ageing / SLA status. */
export const onboardingSlaDays = 14;

export interface ApprovalQueueItemDTO {
  taskId: string;
  vendorId: string;
  vendorName: string;
  function: ApprovalFunction;
  status: ApprovalStatus;
  onboardingStatus: OnboardingStatus | null;
  submittedAt: string | null;
  createdAt: string;
  ageDays: number;
  slaDays: number;
  overSla: boolean;
  notes: string | null;
}

export interface ActivityFeedItemDTO {
  id: string;
  action: string;
  label: string;
  actorName: string | null;
  at: string;
  vendorId: string | null;
  vendorName: string | null;
}

export interface DocumentDTO {
  id: string;
  type: DocumentType;
  typeLabel: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  reviewNote: string | null;
  uploadedByName: string | null;
  createdAt: string;
  downloadUrl: string;
  expiryDate: string | null;
  expiryState: DocumentExpiryState;
}

export interface VendorContactDTO {
  id: string;
  type: ContactType;
  typeLabel: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ReworkSummaryDTO {
  submissionAttempts: number; // initial submit + resubmissions
  corrections: number; // approver change-requests addressed
  documentResubmissions: number; // documents replaced
  changesRequested: number; // approver change-requests raised
}

export interface RequiredDocumentDTO {
  type: DocumentType;
  label: string;
  uploaded: boolean;
  status: DocumentStatus | "MISSING";
  documentId: string | null;
}

export type ProgressStepStatus = "done" | "current" | "todo" | "failed";
export type ProgressGroup = "vendor" | "verification" | "approval";

export interface ProgressStepDTO {
  key: string;
  label: string;
  status: ProgressStepStatus;
  group: ProgressGroup;
}

export interface CurrentActionDTO {
  title: string;
  detail: string;
  owner: string; // e.g. VENDOR, PROCUREMENT, FINANCE...
}

export interface OnboardingProgressDTO {
  percent: number;
  completedSteps: number;
  totalSteps: number;
  steps: ProgressStepDTO[];
  currentAction: CurrentActionDTO | null;
}

// Verification framed for a non-technical vendor (no internal provider details).
export interface VerificationSummaryItemDTO {
  type: VerificationType;
  label: string;
  status: VerificationStatus | "NOT_RUN";
  plainMessage: string;
  reason: string | null;
  action: string | null;
}

export interface ActivityItemDTO {
  id: string;
  action: string;
  label: string;
  actorName: string | null;
  at: string;
}

export interface VendorDetailDTO extends VendorSummaryDTO {
  contactEmail: string | null;
  caseId: string | null;
  viewerCanEdit: boolean;
  invitation: InvitationDTO | null;
  submission: {
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    pan: string | null;
    gstin: string | null;
    udyam: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
    bankName: string | null;
    tradeName: string | null;
    website: string | null;
    corporateAddress: string | null;
    businessType: string | null;
    ownershipStructure: string | null;
    products: string | null;
    components: string | null;
    manufacturingCapability: string | null;
    annualCapacity: string | null;
    leadTimeDays: number | null;
    qualityCertifications: string | null;
    complianceNotes: string | null;
    submittedAt: string | null;
  } | null;
  checks: VerificationCheckDTO[];
  approvals: ApprovalTaskDTO[];
  documents: DocumentDTO[];
  requiredDocuments: RequiredDocumentDTO[];
  verificationSummary: VerificationSummaryItemDTO[];
  progress: OnboardingProgressDTO;
  activity: ActivityItemDTO[];
  contacts: VendorContactDTO[];
  rework: ReworkSummaryDTO;
  sla: SlaSummaryDTO;
  erp: ErpSummaryDTO;
  // Internal-only supplier scorecard; null when the viewer is the vendor.
  scorecard: ScorecardDTO | null;
}
