import { prisma, Prisma } from "@vendor-management/db";
import type {
  ActivityFeedItemDTO,
  ActivityItemDTO,
  ApprovalDecisionInput,
  ApprovalFunction,
  ApprovalQueueItemDTO,
  ApprovalTaskDTO,
  CreateVendorInput,
  DocumentDTO,
  DocumentExpiryState,
  DraftOnboardingInput,
  InvitationDTO,
  OnboardingProgressDTO,
  ProcurementMetricsDTO,
  ProgressStepDTO,
  RemindInput,
  RequiredDocumentDTO,
  ReviewDocumentInput,
  ReworkSummaryDTO,
  SlaStatus,
  SlaSummaryDTO,
  SubmitOnboardingInput,
  UploadDocumentInput,
  UserRole,
  VendorContactDTO,
  VendorContactInput,
  VendorDetailDTO,
  VendorSummaryDTO,
  VerificationCheckDTO,
  VerificationSummaryItemDTO,
  VerificationType,
} from "@vendor-management/shared";
import {
  approvalFunctions,
  approvalSlaDays,
  contactTypeLabels,
  documentTypeLabels,
  maxDocumentBytes,
  onboardingSlaDays,
  requiredDocumentTypes,
  verificationTypes,
} from "@vendor-management/shared";
import { verifiers } from "../providers/verification.js";
import { mockSapClient } from "../providers/sap.js";
import type { AuthContext } from "../middleware/auth.js";
import { notifyRole, notifyVendorContact, safeNotify } from "./notification-service.js";
import { buildScorecard, countPerformanceAtRisk } from "./performance-service.js";

export class ServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const caseInclude = {
  verificationChecks: { orderBy: { type: "asc" } },
  approvalTasks: { orderBy: { function: "asc" }, include: { decidedBy: { select: { name: true } } } },
} satisfies Prisma.OnboardingCaseInclude;

const vendorInclude = {
  onboardingCase: { include: caseInclude },
  documents: { select: { type: true, status: true } },
} satisfies Prisma.VendorInclude;

const vendorDetailInclude = {
  onboardingCase: { include: caseInclude },
  documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
  auditLogs: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } },
  invitations: { orderBy: { createdAt: "desc" }, take: 1 },
  contacts: { orderBy: { type: "asc" } },
  performanceReviews: { orderBy: { period: "asc" }, include: { reviewedBy: { select: { name: true } } } },
} satisfies Prisma.VendorInclude;

type VendorWithCase = Prisma.VendorGetPayload<{ include: typeof vendorInclude }>;
type VendorWithDetail = Prisma.VendorGetPayload<{ include: typeof vendorDetailInclude }>;

// ---------------------------------------------------------------------------
// Access control (enforced in the API, not just the UI)
// ---------------------------------------------------------------------------

const INTERNAL_ROLES: UserRole[] = ["ADMIN", "PROCUREMENT", "FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"];

/** A VENDOR user may only touch the vendor whose contact email matches theirs. */
export function canAccessVendor(vendor: { contactEmail: string | null }, auth: AuthContext): boolean {
  if (INTERNAL_ROLES.includes(auth.role)) return true;
  return (
    auth.role === "VENDOR" &&
    !!vendor.contactEmail &&
    vendor.contactEmail.toLowerCase() === auth.email.toLowerCase()
  );
}

function assertVendorAccess(vendor: { contactEmail: string | null }, auth: AuthContext): void {
  if (!canAccessVendor(vendor, auth)) {
    throw new ServiceError(403, "You do not have access to this vendor");
  }
}

/** Vendor-facing write actions: PROCUREMENT/ADMIN act on any vendor; VENDOR only their own. */
function canEditVendor(vendor: { contactEmail: string | null }, auth: AuthContext): boolean {
  if (auth.role === "ADMIN" || auth.role === "PROCUREMENT") return true;
  return auth.role === "VENDOR" && canAccessVendor(vendor, auth);
}

// ---------------------------------------------------------------------------
// Workflow derivation (drives dashboard "pending actions / blocker / owner")
// ---------------------------------------------------------------------------

interface Workflow {
  completedChecks: number;
  totalChecks: number;
  completedApprovals: number;
  totalApprovals: number;
  pendingActions: string;
  currentBlocker: string | null;
  responsibleFunction: string | null;
}

function deriveWorkflow(vendor: VendorWithCase): Workflow {
  const c = vendor.onboardingCase;
  const checks = c?.verificationChecks ?? [];
  const approvals = c?.approvalTasks ?? [];
  const completedChecks = checks.filter((x) => x.status === "PASSED").length;
  const failedChecks = checks.filter((x) => x.status === "FAILED");
  const completedApprovals = approvals.filter((x) => x.status === "APPROVED").length;
  const pendingApprovalFns = approvals.filter((x) => x.status === "PENDING").map((x) => x.function);

  let pendingActions = "—";
  let responsibleFunction: string | null = null;
  let currentBlocker: string | null = c?.currentBlocker ?? null;

  switch (c?.status) {
    case "CREATED":
      pendingActions = "Vendor to submit company, statutory and bank details";
      responsibleFunction = "VENDOR";
      break;
    case "INFO_SUBMITTED":
    case "VERIFICATION_PASSED":
      pendingActions = "Procurement to run statutory verification";
      responsibleFunction = "PROCUREMENT";
      break;
    case "VERIFICATION_IN_PROGRESS":
      pendingActions = "Verification in progress";
      responsibleFunction = "PLATFORM";
      break;
    case "VERIFICATION_FAILED":
      pendingActions = "Vendor to correct failed checks and resubmit";
      responsibleFunction = "VENDOR";
      currentBlocker =
        currentBlocker ?? `Failed checks: ${failedChecks.map((x) => x.type).join(", ") || "unknown"}`;
      break;
    case "IN_APPROVAL":
      pendingActions = `Awaiting approvals: ${pendingApprovalFns.join(", ")}`;
      responsibleFunction = pendingApprovalFns.join(", ") || null;
      currentBlocker = currentBlocker ?? `Pending approvals from ${pendingApprovalFns.join(", ")}`;
      break;
    case "CHANGES_REQUESTED": {
      const changed = approvals.filter((a) => a.status === "CHANGES_REQUESTED").map((a) => a.function);
      pendingActions = "Vendor to address requested changes and resubmit";
      responsibleFunction = "VENDOR";
      currentBlocker = currentBlocker ?? `Changes requested by ${changed.join(", ") || "an approver"}`;
      break;
    }
    case "VERIFIED":
      if (vendor.erpStatus === "FAILED") {
        pendingActions = "Onboarding complete — ERP handoff failed, retry required";
        responsibleFunction = "PROCUREMENT";
        currentBlocker = currentBlocker ?? `ERP sync failed${vendor.erpError ? `: ${vendor.erpError}` : ""}`;
      } else if (vendor.erpStatus === "PENDING") {
        pendingActions = "Onboarding complete — ERP handoff in progress";
        responsibleFunction = "PLATFORM";
        currentBlocker = null;
      } else {
        pendingActions = vendor.sapVendorId ? `Onboarding complete (SAP ${vendor.sapVendorId})` : "Onboarding complete";
        responsibleFunction = null;
        currentBlocker = null;
      }
      break;
    case "REJECTED":
      pendingActions = "Onboarding rejected";
      responsibleFunction = null;
      break;
    default:
      pendingActions = "Awaiting onboarding case";
  }

  return {
    completedChecks,
    totalChecks: checks.length,
    completedApprovals,
    totalApprovals: approvals.length,
    pendingActions,
    currentBlocker,
    responsibleFunction,
  };
}

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------

function toSummary(vendor: VendorWithCase): VendorSummaryDTO {
  const wf = deriveWorkflow(vendor);
  const requiredDocsUploaded = requiredDocumentTypes.filter((t) =>
    vendor.documents.some((d) => d.type === t && d.status !== "REJECTED"),
  ).length;
  const caseUpdated = vendor.onboardingCase?.updatedAt;
  const lastUpdated = caseUpdated && caseUpdated > vendor.updatedAt ? caseUpdated : vendor.updatedAt;
  const sla = buildSla(vendor.createdAt, vendor.onboardingCase, wf);
  return {
    id: vendor.id,
    legalName: vendor.legalName,
    displayName: vendor.displayName,
    category: vendor.category,
    tier: vendor.tier,
    progressPercent: computeStepStates(vendor).percent,
    status: vendor.status,
    onboardingStatus: vendor.onboardingCase?.status ?? null,
    sapVendorId: vendor.sapVendorId,
    completedChecks: wf.completedChecks,
    totalChecks: wf.totalChecks,
    completedApprovals: wf.completedApprovals,
    totalApprovals: wf.totalApprovals,
    requiredDocsUploaded,
    requiredDocsTotal: requiredDocumentTypes.length,
    pendingActions: wf.pendingActions,
    currentBlocker: wf.currentBlocker,
    responsibleFunction: wf.responsibleFunction,
    slaStatus: sla.slaStatus,
    onboardingAgeDays: sla.onboardingAgeDays,
    erpStatus: vendor.erpStatus,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: lastUpdated.toISOString(),
  };
}

function mapChecks(vendor: VendorWithCase): VerificationCheckDTO[] {
  return (vendor.onboardingCase?.verificationChecks ?? []).map((x) => ({
    id: x.id,
    type: x.type,
    status: x.status,
    provider: x.provider,
    reference: x.reference,
    message: x.message,
    checkedAt: x.checkedAt?.toISOString() ?? null,
  }));
}

function mapApprovals(vendor: VendorWithCase): ApprovalTaskDTO[] {
  return (vendor.onboardingCase?.approvalTasks ?? []).map((x) => ({
    id: x.id,
    function: x.function,
    status: x.status,
    decidedByName: x.decidedBy?.name ?? null,
    decidedAt: x.decidedAt?.toISOString() ?? null,
    notes: x.notes,
  }));
}

/**
 * A vendor may track the approval pipeline status (which function is pending /
 * approved / has requested changes) but must NOT see internal reviewer
 * identities or internal deliberation notes. Change-request notes are kept
 * because they are the correction instructions directed at the vendor.
 */
function redactApprovalsForViewer(approvals: ApprovalTaskDTO[], auth?: AuthContext): ApprovalTaskDTO[] {
  if (auth?.role !== "VENDOR") return approvals;
  return approvals.map((a) => ({
    ...a,
    decidedByName: null,
    notes: a.status === "CHANGES_REQUESTED" ? a.notes : null,
  }));
}

function expiryState(expiry: Date | null): DocumentExpiryState {
  if (!expiry) return "NONE";
  const days = (expiry.getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "EXPIRING_SOON";
  return "VALID";
}

function mapDocuments(vendor: VendorWithDetail): DocumentDTO[] {
  return vendor.documents.map((d) => ({
    id: d.id,
    type: d.type,
    typeLabel: documentTypeLabels[d.type],
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    status: d.status,
    reviewNote: d.reviewNote,
    uploadedByName: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(),
    downloadUrl: `/api/documents/${d.id}/download`,
    expiryDate: d.expiryDate?.toISOString() ?? null,
    expiryState: expiryState(d.expiryDate),
  }));
}

function mapContacts(vendor: VendorWithDetail): VendorContactDTO[] {
  return vendor.contacts.map((c) => ({
    id: c.id,
    type: c.type,
    typeLabel: contactTypeLabels[c.type],
    name: c.name,
    email: c.email,
    phone: c.phone,
  }));
}

// Rework is derived from the audit trail (no separate counters to keep in sync).
function buildRework(vendor: VendorWithDetail): ReworkSummaryDTO {
  const actions = vendor.auditLogs.map((a) => a.action);
  const count = (name: string) => actions.filter((a) => a === name).length;
  const resubmissions = count("ONBOARDING_RESUBMITTED");
  return {
    submissionAttempts: (count("ONBOARDING_SUBMITTED") || 0) + resubmissions,
    corrections: resubmissions,
    documentResubmissions: count("DOCUMENT_REPLACED"),
    changesRequested: count("APPROVAL_CHANGES_REQUESTED"),
  };
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Ageing / SLA is derived, never stored: how long the onboarding has been open,
 * how long it has sat with the current owner, and whether it is within the
 * {@link onboardingSlaDays} target.
 */
function buildSla(
  vendorCreatedAt: Date,
  caseData: { status: string; createdAt: Date; updatedAt: Date } | null,
  wf: Workflow,
): SlaSummaryDTO {
  const now = new Date();
  const start = caseData?.createdAt ?? vendorCreatedAt;
  const onboardingAgeDays = daysBetween(start, now);
  const owner = wf.responsibleFunction;
  const heldDays = daysBetween(caseData?.updatedAt ?? vendorCreatedAt, now);
  const done = caseData?.status === "VERIFIED" || caseData?.status === "REJECTED";

  let slaStatus: SlaStatus;
  if (done) slaStatus = "DONE";
  else if (onboardingAgeDays >= onboardingSlaDays) slaStatus = "BREACHED";
  else if (onboardingAgeDays >= onboardingSlaDays * 0.75) slaStatus = "AT_RISK";
  else slaStatus = "ON_TRACK";

  return {
    onboardingAgeDays,
    vendorPendingDays: owner === "VENDOR" ? heldDays : 0,
    buyerPendingDays: owner && owner !== "VENDOR" ? heldDays : 0,
    currentOwner: done ? null : owner,
    slaDays: onboardingSlaDays,
    slaStatus,
  };
}

/** Current (latest, non-rejected) document per required type, plus what's missing. */
function buildRequiredDocuments(vendor: VendorWithDetail): RequiredDocumentDTO[] {
  return requiredDocumentTypes.map((type) => {
    const current = vendor.documents.find((d) => d.type === type && d.status !== "REJECTED");
    const rejected = vendor.documents.find((d) => d.type === type && d.status === "REJECTED");
    const doc = current ?? rejected;
    return {
      type,
      label: documentTypeLabels[type],
      uploaded: !!current,
      status: doc ? doc.status : "MISSING",
      documentId: doc?.id ?? null,
    };
  });
}

// Works for both the summary (documents: {type,status}) and detail payloads.
function requiredDocsComplete(vendor: VendorWithCase): boolean {
  return requiredDocumentTypes.every((type) =>
    vendor.documents.some((d) => d.type === type && d.status !== "REJECTED"),
  );
}

interface RawStep {
  key: string;
  label: string;
  group: ProgressStepDTO["group"];
  state: "done" | "failed" | "todo";
}

// The single source of truth for onboarding progress (derived from persisted DB
// records). Only needs document type/status, so both summary + detail can use it.
function computeStepStates(vendor: VendorWithCase): { raw: RawStep[]; completedSteps: number; totalSteps: number; percent: number } {
  const c = vendor.onboardingCase;
  const checks = c?.verificationChecks ?? [];
  const approvals = c?.approvalTasks ?? [];
  const checkStatus = (t: VerificationType): "done" | "failed" | "todo" => {
    const chk = checks.find((x) => x.type === t);
    if (!chk) return "todo";
    if (chk.status === "PASSED") return "done";
    if (chk.status === "FAILED") return "failed";
    return "todo";
  };
  const raw: RawStep[] = [
    { key: "company", label: "Company information", group: "vendor", state: companyComplete(c) ? "done" : "todo" },
    { key: "statutory", label: "Statutory information", group: "vendor", state: statutoryComplete(c) ? "done" : "todo" },
    { key: "bank", label: "Bank information", group: "vendor", state: bankComplete(c) ? "done" : "todo" },
    { key: "documents", label: "Documents", group: "vendor", state: requiredDocsComplete(vendor) ? "done" : "todo" },
    { key: "submit", label: "Review & submit", group: "vendor", state: c?.submittedAt ? "done" : "todo" },
    { key: "pan_check", label: "PAN verification", group: "verification", state: checkStatus("PAN") },
    { key: "gst_check", label: "GST verification", group: "verification", state: checkStatus("GST") },
    { key: "udyam_check", label: "Udyam verification", group: "verification", state: checkStatus("UDYAM") },
    { key: "bank_check", label: "Bank verification", group: "verification", state: checkStatus("BANK") },
    {
      key: "approvals",
      label: "Internal approvals",
      group: "approval",
      state: approvals.length > 0 && approvals.every((a) => a.status === "APPROVED") ? "done" : "todo",
    },
    { key: "complete", label: "Verified & SAP handoff", group: "approval", state: c?.status === "VERIFIED" ? "done" : "todo" },
  ];
  const completedSteps = raw.filter((s) => s.state === "done").length;
  return { raw, completedSteps, totalSteps: raw.length, percent: Math.round((completedSteps / raw.length) * 100) };
}

const PLAIN_CHECK_LABELS: Record<VerificationType, string> = {
  PAN: "PAN",
  GST: "GST",
  UDYAM: "Udyam",
  BANK: "Bank account",
};

const PLAIN_FAIL_REASON: Record<VerificationType, string> = {
  PAN: "The submitted PAN could not be verified.",
  GST: "The submitted GST information could not be verified.",
  UDYAM: "The submitted Udyam registration could not be verified.",
  BANK: "The submitted bank details could not be verified.",
};

const PLAIN_FAIL_ACTION: Record<VerificationType, string> = {
  PAN: "Review the PAN and resubmit.",
  GST: "Review the GSTIN and resubmit.",
  UDYAM: "Review the Udyam number and resubmit.",
  BANK: "Review the bank account details and resubmit.",
};

function buildVerificationSummary(vendor: VendorWithCase): VerificationSummaryItemDTO[] {
  const checks = vendor.onboardingCase?.verificationChecks ?? [];
  return verificationTypes.map((type) => {
    const check = checks.find((c) => c.type === type);
    const label = PLAIN_CHECK_LABELS[type];
    if (!check) {
      return { type, label, status: "NOT_RUN", plainMessage: "Not verified yet", reason: null, action: null };
    }
    if (check.status === "PASSED") {
      return { type, label, status: "PASSED", plainMessage: "Verified", reason: null, action: null };
    }
    if (check.status === "FAILED") {
      return {
        type,
        label,
        status: "FAILED",
        plainMessage: "Verification failed",
        reason: PLAIN_FAIL_REASON[type],
        action: PLAIN_FAIL_ACTION[type],
      };
    }
    return { type, label, status: "PENDING", plainMessage: "Verification in progress", reason: null, action: null };
  });
}

// Section-completeness helpers (all derived from real DB records).
function companyComplete(c: VendorWithCase["onboardingCase"]): boolean {
  return !!(c?.contactName && c?.contactEmail && c?.addressLine1 && c?.city && c?.state && c?.postalCode);
}
function statutoryComplete(c: VendorWithCase["onboardingCase"]): boolean {
  return !!(c?.pan && c?.gstin && c?.udyam);
}
function bankComplete(c: VendorWithCase["onboardingCase"]): boolean {
  return !!(c?.bankAccountName && c?.bankAccountNumber && c?.bankIfsc && c?.bankName);
}

function buildProgress(vendor: VendorWithDetail): OnboardingProgressDTO {
  const { raw, completedSteps, totalSteps, percent } = computeStepStates(vendor);
  let currentAssigned = false;
  const steps: ProgressStepDTO[] = raw.map((s) => {
    let status: ProgressStepDTO["status"];
    if (s.state === "done") status = "done";
    else if (s.state === "failed") status = "failed";
    else if (!currentAssigned) {
      status = "current";
      currentAssigned = true;
    } else status = "todo";
    return { key: s.key, label: s.label, status, group: s.group };
  });
  return { percent, completedSteps, totalSteps, steps, currentAction: buildCurrentAction(vendor) };
}

function buildCurrentAction(vendor: VendorWithDetail): OnboardingProgressDTO["currentAction"] {
  const c = vendor.onboardingCase;
  if (!c) return { title: "Awaiting onboarding case", detail: "", owner: "PROCUREMENT" };

  if (c.status === "VERIFIED") {
    return { title: "Onboarding complete", detail: `Vendor verified${vendor.sapVendorId ? ` (SAP ${vendor.sapVendorId})` : ""}.`, owner: "—" };
  }
  if (c.status === "REJECTED") {
    return { title: "Onboarding rejected", detail: c.currentBlocker ?? "The onboarding was rejected.", owner: "—" };
  }
  if (c.status === "VERIFICATION_FAILED") {
    const failed = (c.verificationChecks ?? []).filter((x) => x.status === "FAILED").map((x) => PLAIN_CHECK_LABELS[x.type]);
    return { title: "Fix failed checks and resubmit", detail: `Failed: ${failed.join(", ") || "unknown"}.`, owner: "VENDOR" };
  }
  if (c.status === "CHANGES_REQUESTED") {
    const changed = (c.approvalTasks ?? []).filter((a) => a.status === "CHANGES_REQUESTED");
    const who = changed.map((a) => a.function).join(", ") || "an approver";
    const reason = changed.map((a) => a.notes).filter(Boolean).join(" · ");
    return { title: `Address changes requested by ${who}`, detail: reason || "Update your information/documents and resubmit.", owner: "VENDOR" };
  }
  if (c.status === "IN_APPROVAL") {
    const pending = (c.approvalTasks ?? []).filter((a) => a.status === "PENDING").map((a) => a.function);
    return { title: "Awaiting internal approvals", detail: `Pending: ${pending.join(", ")}.`, owner: pending.join(", ") || "APPROVERS" };
  }
  // Not yet submitted / awaiting verification: point at the first missing vendor step.
  if (!companyComplete(c)) return { title: "Complete company information", detail: "Add contact and address details.", owner: "VENDOR" };
  if (!statutoryComplete(c)) return { title: "Complete statutory information", detail: "Add PAN, GSTIN and Udyam number.", owner: "VENDOR" };
  if (!bankComplete(c)) return { title: "Complete bank information", detail: "Add bank account and IFSC details.", owner: "VENDOR" };
  if (!requiredDocsComplete(vendor)) {
    const missing = buildRequiredDocuments(vendor).filter((d) => !d.uploaded).map((d) => d.label);
    return { title: `Upload: ${missing[0] ?? "required documents"}`, detail: `Missing: ${missing.join(", ")}.`, owner: "VENDOR" };
  }
  if (!c.submittedAt) return { title: "Review and submit", detail: "Review your information, then submit for verification.", owner: "VENDOR" };
  return { title: "Waiting for verification", detail: "Procurement will run statutory verification.", owner: "PROCUREMENT" };
}

const ACTIVITY_LABELS: Record<string, string> = {
  REQUEST_CREATED: "Vendor request raised",
  REQUEST_STATUS_CHANGED: "Request status changed",
  REQUEST_CONVERTED: "Request converted to vendor",
  VENDOR_CREATED: "Vendor created",
  INVITATION_SENT: "Onboarding invitation sent",
  INVITATION_OPENED: "Vendor opened the invitation",
  ONBOARDING_STARTED: "Vendor started onboarding",
  ONBOARDING_PROGRESS_UPDATED: "Vendor saved progress",
  ONBOARDING_SUBMITTED: "Vendor submitted onboarding details",
  ONBOARDING_RESUBMITTED: "Vendor resubmitted after requested changes",
  DOCUMENT_UPLOADED: "Document uploaded",
  DOCUMENT_REPLACED: "Document replaced",
  DOCUMENT_REVIEWED: "Document reviewed",
  VERIFICATION_PASSED: "Verification passed",
  VERIFICATION_FAILED: "Verification failed",
  APPROVAL_APPROVED: "Approval granted",
  APPROVAL_REJECTED: "Approval rejected",
  APPROVAL_CHANGES_REQUESTED: "Changes requested",
  SAP_HANDOFF: "Handed off to SAP",
  ERP_SYNC_FAILED: "ERP handoff failed",
  REMINDER_SENT: "Reminder sent",
  PERFORMANCE_REVIEW_RECORDED: "Performance review recorded",
  INVOICE_RECORDED: "Invoice recorded",
  INVOICE_APPROVED: "Invoice approved",
  INVOICE_CANCELLED: "Invoice cancelled",
  PAYMENT_RECORDED: "Payment recorded",
  CONTRACT_CREATED: "Contract created",
  CONTRACT_ACTIVE: "Contract activated",
  CONTRACT_TERMINATED: "Contract terminated",
  CONTRACT_RENEWED: "Contract renewed",
  ROLE_CHANGED: "User role changed",
};

/** Human-readable label for an audit action (shared by detail + global feed). */
export function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase();
}

function buildActivity(vendor: VendorWithDetail): ActivityItemDTO[] {
  return vendor.auditLogs.map((a) => ({
    id: a.id,
    action: a.action,
    label: ACTIVITY_LABELS[a.action] ?? a.action.replaceAll("_", " ").toLowerCase(),
    actorName: a.actor?.name ?? null,
    at: a.createdAt.toISOString(),
  }));
}

function mapInvitation(vendor: VendorWithDetail): InvitationDTO | null {
  const inv = vendor.invitations[0];
  if (!inv) return null;
  return {
    id: inv.id,
    status: inv.status,
    email: inv.email,
    expiresAt: inv.expiresAt.toISOString(),
    openedAt: inv.openedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    expired: inv.status !== "REVOKED" && inv.expiresAt.getTime() < Date.now(),
  };
}

function toDetail(vendor: VendorWithDetail, auth?: AuthContext): VendorDetailDTO {
  const c = vendor.onboardingCase;
  return {
    ...toSummary(vendor),
    contactEmail: vendor.contactEmail,
    caseId: c?.id ?? null,
    viewerCanEdit: auth ? canEditVendor(vendor, auth) : false,
    invitation: mapInvitation(vendor),
    submission: c
      ? {
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          addressLine1: c.addressLine1,
          city: c.city,
          state: c.state,
          postalCode: c.postalCode,
          country: c.country,
          pan: c.pan,
          gstin: c.gstin,
          udyam: c.udyam,
          bankAccountName: c.bankAccountName,
          bankAccountNumber: c.bankAccountNumber,
          bankIfsc: c.bankIfsc,
          bankName: c.bankName,
          tradeName: c.tradeName,
          website: c.website,
          corporateAddress: c.corporateAddress,
          businessType: c.businessType,
          ownershipStructure: c.ownershipStructure,
          products: c.products,
          components: c.components,
          manufacturingCapability: c.manufacturingCapability,
          annualCapacity: c.annualCapacity,
          leadTimeDays: c.leadTimeDays,
          qualityCertifications: c.qualityCertifications,
          complianceNotes: c.complianceNotes,
          submittedAt: c.submittedAt?.toISOString() ?? null,
        }
      : null,
    checks: mapChecks(vendor),
    approvals: redactApprovalsForViewer(mapApprovals(vendor), auth),
    documents: mapDocuments(vendor),
    requiredDocuments: buildRequiredDocuments(vendor),
    verificationSummary: buildVerificationSummary(vendor),
    progress: buildProgress(vendor),
    activity: buildActivity(vendor),
    contacts: mapContacts(vendor),
    rework: buildRework(vendor),
    sla: buildSla(vendor.createdAt, c, deriveWorkflow(vendor)),
    erp: {
      status: vendor.erpStatus,
      provider: vendor.erpProvider,
      sapVendorId: vendor.sapVendorId,
      syncedAt: vendor.erpSyncedAt?.toISOString() ?? null,
      lastAttemptAt: vendor.erpLastAttemptAt?.toISOString() ?? null,
      error: vendor.erpError,
    },
    // Scorecard is internal-only; a vendor viewer never sees performance data.
    scorecard: auth && auth.role !== "VENDOR" ? buildScorecard(vendor.performanceReviews) : null,
  };
}

async function loadVendorOrThrow(vendorId: string): Promise<VendorWithCase> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, include: vendorInclude });
  if (!vendor) throw new ServiceError(404, "Vendor not found");
  return vendor;
}

async function loadDetailOrThrow(vendorId: string): Promise<VendorWithDetail> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, include: vendorDetailInclude });
  if (!vendor) throw new ServiceError(404, "Vendor not found");
  return vendor;
}

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------

export async function listVendors(auth: AuthContext): Promise<VendorSummaryDTO[]> {
  // API-level scoping: a VENDOR only sees the vendor(s) matching their email.
  const where: Prisma.VendorWhereInput =
    auth.role === "VENDOR" ? { contactEmail: { equals: auth.email, mode: "insensitive" } } : {};
  const vendors = await prisma.vendor.findMany({ where, include: vendorInclude, orderBy: { createdAt: "desc" } });
  return vendors.map(toSummary);
}

export async function getVendorDetail(vendorId: string, auth?: AuthContext): Promise<VendorDetailDTO> {
  const vendor = await loadDetailOrThrow(vendorId);
  if (auth) assertVendorAccess(vendor, auth);
  return toDetail(vendor, auth);
}

export interface VendorLiveStatus {
  onboardingStatus: string | null;
  progressPercent: number;
  currentBlocker: string | null;
  currentOwner: string | null;
  pendingAction: string;
  erpStatus: string | null;
  sapVendorId: string | null;
}

/** A limited, non-sensitive status snapshot (used by the Business/Requestor view). */
export async function getVendorLiveStatus(vendorId: string): Promise<VendorLiveStatus | null> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, include: vendorDetailInclude });
  if (!vendor) return null;
  const wf = deriveWorkflow(vendor);
  return {
    onboardingStatus: vendor.onboardingCase?.status ?? null,
    progressPercent: computeStepStates(vendor).percent,
    currentBlocker: wf.currentBlocker,
    currentOwner: wf.responsibleFunction,
    pendingAction: wf.pendingActions,
    erpStatus: vendor.erpStatus,
    sapVendorId: vendor.sapVendorId,
  };
}

/** Procurement creates a vendor; an onboarding case is opened in the same transaction. */
export async function createVendor(input: CreateVendorInput, actor: AuthContext): Promise<VendorDetailDTO> {
  const vendorId = await prisma.$transaction(async (tx): Promise<string> => {
    const vendor = await tx.vendor.create({
      data: {
        legalName: input.legalName,
        displayName: input.displayName ?? null,
        category: input.category ?? null,
        tier: input.tier ?? null,
        contactEmail: input.contactEmail ?? null,
        status: "ONBOARDING",
        createdById: actor.userId,
        onboardingCase: { create: { status: "CREATED" } },
      },
    });
    await tx.auditLog.create({
      data: {
        vendorId: vendor.id,
        actorId: actor.userId,
        action: "VENDOR_CREATED",
        detail: { legalName: vendor.legalName, by: actor.email },
      },
    });
    return vendor.id;
  }, { timeout: 30000, maxWait: 15000 });
  return getVendorDetail(vendorId, actor);
}

/** Vendor submits company / statutory / bank details into the onboarding case. */
export async function submitOnboarding(
  vendorId: string,
  input: SubmitOnboardingInput,
  actor: AuthContext,
): Promise<VendorDetailDTO> {
  const vendor = await loadVendorOrThrow(vendorId);
  if (!canEditVendor(vendor, actor)) throw new ServiceError(403, "You do not have access to this vendor");
  const c = vendor.onboardingCase;
  if (!c) throw new ServiceError(409, "Onboarding case does not exist for this vendor");
  if (c.status === "VERIFIED") throw new ServiceError(409, "Vendor is already verified");

  // Review & Submit gate: all mandatory documents must be uploaded first.
  if (!requiredDocsComplete(vendor)) {
    const missing = requiredDocumentTypes
      .filter((t) => !vendor.documents.some((d) => d.type === t && d.status !== "REJECTED"))
      .map((t) => documentTypeLabels[t]);
    throw new ServiceError(409, `Upload all required documents before submitting. Missing: ${missing.join(", ")}`);
  }

  // If the vendor is correcting approver-requested changes, resume approvals
  // (rather than going back to pre-verification INFO_SUBMITTED).
  const resuming = c.status === "CHANGES_REQUESTED";

  await prisma.$transaction(async (tx) => {
    await tx.onboardingCase.update({
      where: { id: c.id },
      data: {
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        addressLine1: input.addressLine1,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country,
        pan: input.pan,
        gstin: input.gstin,
        udyam: input.udyam,
        bankAccountName: input.bankAccountName,
        bankAccountNumber: input.bankAccountNumber,
        bankIfsc: input.bankIfsc,
        bankName: input.bankName,
        tradeName: input.tradeName ?? undefined,
        website: input.website ?? undefined,
        corporateAddress: input.corporateAddress ?? undefined,
        businessType: input.businessType ?? undefined,
        ownershipStructure: input.ownershipStructure ?? undefined,
        products: input.products ?? undefined,
        components: input.components ?? undefined,
        manufacturingCapability: input.manufacturingCapability ?? undefined,
        annualCapacity: input.annualCapacity ?? undefined,
        leadTimeDays: input.leadTimeDays ?? undefined,
        qualityCertifications: input.qualityCertifications ?? undefined,
        complianceNotes: input.complianceNotes ?? undefined,
        status: resuming ? "IN_APPROVAL" : "INFO_SUBMITTED",
        submittedAt: new Date(),
        currentBlocker: null,
      },
    });
    if (resuming) {
      // Re-open the approval tasks that had requested changes.
      await tx.approvalTask.updateMany({
        where: { onboardingCaseId: c.id, status: "CHANGES_REQUESTED" },
        data: { status: "PENDING", decidedById: null, decidedAt: null },
      });
    }
    await tx.auditLog.create({
      data: {
        vendorId: vendor.id,
        onboardingCaseId: c.id,
        actorId: actor.userId,
        action: resuming ? "ONBOARDING_RESUBMITTED" : "ONBOARDING_SUBMITTED",
        detail: { pan: input.pan, gstin: input.gstin, by: actor.email },
      },
    });
  }, { timeout: 30000, maxWait: 15000 });
  return getVendorDetail(vendorId, actor);
}

// Onboarding states in which the vendor may still edit / save a draft.
const EDITABLE_STATUSES = new Set(["CREATED", "IN_PROGRESS", "VERIFICATION_FAILED", "CHANGES_REQUESTED"]);

/**
 * Save & resume: persist a partial draft of the onboarding form without
 * submitting. Marks the case IN_PROGRESS on first save. Fields not provided are
 * left unchanged, so progress accumulates across sessions.
 */
export async function saveDraft(
  vendorId: string,
  input: DraftOnboardingInput,
  actor: AuthContext,
): Promise<VendorDetailDTO> {
  const vendor = await loadVendorOrThrow(vendorId);
  if (!canEditVendor(vendor, actor)) throw new ServiceError(403, "You do not have access to this vendor");
  const c = vendor.onboardingCase;
  if (!c) throw new ServiceError(409, "Onboarding case does not exist for this vendor");
  if (!EDITABLE_STATUSES.has(c.status)) {
    throw new ServiceError(409, "Onboarding can no longer be edited in its current state");
  }

  const starting = c.status === "CREATED";
  await prisma.$transaction(
    async (tx) => {
      await tx.onboardingCase.update({
        where: { id: c.id },
        data: { ...input, status: starting ? "IN_PROGRESS" : c.status },
      });
      await tx.auditLog.create({
        data: {
          vendorId: vendor.id,
          onboardingCaseId: c.id,
          actorId: actor.userId,
          action: starting ? "ONBOARDING_STARTED" : "ONBOARDING_PROGRESS_UPDATED",
          detail: { fields: Object.keys(input), by: actor.email },
        },
      });
    },
    { timeout: 30000, maxWait: 15000 },
  );
  return getVendorDetail(vendorId, actor);
}

/**
 * Run the four statutory checks through the mock providers, persist each
 * result, and — if all pass — open Finance/Tax/Legal/Quality approvals IN PARALLEL.
 */
export async function runVerification(vendorId: string, actor: AuthContext): Promise<VendorDetailDTO> {
  const vendor = await loadVendorOrThrow(vendorId);
  const c = vendor.onboardingCase;
  if (!c) throw new ServiceError(409, "Onboarding case does not exist for this vendor");
  if (!c.submittedAt || !c.pan || !c.gstin || !c.udyam || !c.bankAccountNumber || !c.bankIfsc) {
    throw new ServiceError(409, "Vendor details must be submitted before verification");
  }
  if (c.status === "IN_APPROVAL" || c.status === "VERIFIED") {
    throw new ServiceError(409, "Verification already completed for this vendor");
  }

  const input = {
    pan: c.pan,
    gstin: c.gstin,
    udyam: c.udyam,
    bankAccountNumber: c.bankAccountNumber,
    bankIfsc: c.bankIfsc,
    bankAccountName: c.bankAccountName ?? "",
  };

  // Run providers (parallel). Provider calls are external, so they run before the tx.
  const outcomes = await Promise.all(
    verificationTypes.map(async (type) => ({ type, outcome: await verifiers[type].verify(input) })),
  );
  const allPassed = outcomes.every((o) => o.outcome.passed);
  const failed = outcomes.filter((o) => !o.outcome.passed).map((o) => o.type);

  await prisma.$transaction(
    async (tx) => {
      // Replace any prior check rows for this case, then insert the new results
      // in a single round-trip (keeps the transaction well under its timeout).
      await tx.verificationCheck.deleteMany({ where: { onboardingCaseId: c.id } });
      await tx.verificationCheck.createMany({
        data: outcomes.map(({ type, outcome }) => ({
          onboardingCaseId: c.id,
          type,
          status: (outcome.passed ? "PASSED" : "FAILED") as "PASSED" | "FAILED",
          provider: outcome.provider,
          reference: outcome.reference,
          message: outcome.message,
          result: outcome.result as Prisma.InputJsonValue,
          checkedAt: new Date(),
        })),
      });

      if (allPassed) {
        // Create the approval tasks in parallel (all PENDING, no ordering).
        await tx.approvalTask.createMany({
          data: approvalFunctions.map((fn) => ({ onboardingCaseId: c.id, function: fn, status: "PENDING" as const })),
          skipDuplicates: true,
        });
        await tx.onboardingCase.update({
          where: { id: c.id },
          data: { status: "IN_APPROVAL", currentBlocker: null },
        });
      } else {
        await tx.onboardingCase.update({
          where: { id: c.id },
          data: { status: "VERIFICATION_FAILED", currentBlocker: `Failed checks: ${failed.join(", ")}` },
        });
      }

      await tx.auditLog.create({
        data: {
          vendorId: vendor.id,
          onboardingCaseId: c.id,
          actorId: actor.userId,
          action: allPassed ? "VERIFICATION_PASSED" : "VERIFICATION_FAILED",
          detail: { results: outcomes.map((o) => ({ type: o.type, passed: o.outcome.passed })), by: actor.email },
        },
      });
    },
    { timeout: 30000, maxWait: 15000 },
  );

  // Fan-out notifications (best-effort; never blocks the workflow).
  if (allPassed) {
    await safeNotify(async () => {
      await Promise.all(
        approvalFunctions.map((fn) =>
          notifyRole(fn, {
            type: "APPROVAL_PENDING",
            title: `Approval pending: ${vendor.legalName}`,
            body: `${vendor.legalName} passed verification and is awaiting your approval.`,
            vendorId: vendor.id,
            relatedType: "approval",
          }),
        ),
      );
    });
  } else {
    await safeNotify(() =>
      notifyVendorContact(vendor.contactEmail, {
        type: "VERIFICATION_FAILED",
        title: "Verification failed — action required",
        body: `Some checks did not pass (${failed.join(", ")}). Please correct the details and resubmit.`,
        vendorId: vendor.id,
        relatedType: "onboarding",
      }),
    );
  }

  return getVendorDetail(vendorId, actor);
}

/**
 * An approver completes their function's task. When all four are APPROVED, a
 * single transaction flips the case + vendor to VERIFIED, performs the mock SAP
 * handoff, stores the SAP vendor id, and writes an audit log.
 */
export async function completeApproval(
  vendorId: string,
  fn: ApprovalFunction,
  input: ApprovalDecisionInput,
  actor: AuthContext,
): Promise<VendorDetailDTO> {
  const vendor = await loadVendorOrThrow(vendorId);
  const c = vendor.onboardingCase;
  if (!c) throw new ServiceError(409, "Onboarding case does not exist for this vendor");
  if (c.status !== "IN_APPROVAL") {
    throw new ServiceError(409, "Vendor is not awaiting approvals");
  }
  const task = c.approvalTasks.find((t) => t.function === fn);
  if (!task) throw new ServiceError(404, `No ${fn} approval task for this vendor`);
  if (task.status !== "PENDING") throw new ServiceError(409, `${fn} approval already ${task.status.toLowerCase()}`);

  let justVerified = false;
  await prisma.$transaction(async (tx) => {
    await tx.approvalTask.update({
      where: { id: task.id },
      data: {
        status: input.decision,
        decidedById: actor.userId,
        decidedAt: new Date(),
        notes: input.notes ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        vendorId: vendor.id,
        onboardingCaseId: c.id,
        actorId: actor.userId,
        action: `APPROVAL_${input.decision}`,
        detail: { function: fn, by: actor.email, notes: input.notes ?? null },
      },
    });

    if (input.decision === "REJECTED") {
      await tx.onboardingCase.update({
        where: { id: c.id },
        data: { status: "REJECTED", currentBlocker: `Rejected by ${fn}` },
      });
      await tx.vendor.update({ where: { id: vendor.id }, data: { status: "REJECTED" } });
      return;
    }

    if (input.decision === "CHANGES_REQUESTED") {
      // Send the case back to the vendor for correction; the vendor stays in
      // onboarding (not rejected) and can resubmit to resume approvals.
      await tx.onboardingCase.update({
        where: { id: c.id },
        data: { status: "CHANGES_REQUESTED", currentBlocker: `Changes requested by ${fn}: ${input.notes}` },
      });
      return;
    }

    // Approved: are all approvals now in?
    const remaining = await tx.approvalTask.count({
      where: { onboardingCaseId: c.id, status: { not: "APPROVED" } },
    });
    if (remaining === 0) {
      // Verification is complete. The ERP handoff is a SEPARATE lifecycle run
      // after this transaction so a handoff failure never blocks verification.
      await tx.onboardingCase.update({
        where: { id: c.id },
        data: { status: "VERIFIED", verifiedAt: new Date(), currentBlocker: null },
      });
      await tx.vendor.update({
        where: { id: vendor.id },
        data: { status: "VERIFIED", erpStatus: "PENDING" },
      });
      justVerified = true;
    }
  }, { timeout: 30000, maxWait: 15000 });

  // Kick off the ERP/SAP handoff once the vendor is verified (own lifecycle).
  if (justVerified) {
    await attemptErpSync(
      { id: vendor.id, legalName: vendor.legalName, pan: c.pan, gstin: c.gstin, onboardingCaseId: c.id },
      actor,
    );
  }

  // Notify the vendor when a decision needs their action.
  if (input.decision === "CHANGES_REQUESTED") {
    await safeNotify(() =>
      notifyVendorContact(vendor.contactEmail, {
        type: "VENDOR_ACTION_REQUIRED",
        title: `Changes requested by ${fn}`,
        body: input.notes ?? "An approver requested changes. Please review and resubmit.",
        vendorId: vendor.id,
        relatedType: "approval",
      }),
    );
  } else if (input.decision === "REJECTED") {
    await safeNotify(() =>
      notifyVendorContact(vendor.contactEmail, {
        type: "VENDOR_ACTION_REQUIRED",
        title: `Onboarding rejected by ${fn}`,
        body: input.notes ?? `Your onboarding was rejected by ${fn}.`,
        vendorId: vendor.id,
        relatedType: "approval",
      }),
    );
  }

  return getVendorDetail(vendorId, actor);
}

// ---------------------------------------------------------------------------
// ERP / SAP vendor-master handoff (its own lifecycle: PENDING → SYNCED / FAILED)
// ---------------------------------------------------------------------------

interface ErpSyncTarget {
  id: string;
  legalName: string;
  pan: string | null;
  gstin: string | null;
  onboardingCaseId: string | null;
}

/**
 * Attempt the ERP handoff for a verified vendor. On success the vendor is marked
 * SYNCED with its SAP id; on failure it is marked FAILED with the captured error
 * and procurement is notified — either way the vendor stays VERIFIED and the
 * handoff can be retried.
 */
async function attemptErpSync(target: ErpSyncTarget, actor: AuthContext): Promise<void> {
  await prisma.vendor.update({
    where: { id: target.id },
    data: { erpStatus: "PENDING", erpLastAttemptAt: new Date(), erpError: null },
  });
  try {
    const sap = await mockSapClient.createVendor({
      vendorId: target.id,
      legalName: target.legalName,
      pan: target.pan,
      gstin: target.gstin,
    });
    await prisma.vendor.update({
      where: { id: target.id },
      data: {
        erpStatus: "SYNCED",
        sapVendorId: sap.sapVendorId,
        erpProvider: sap.provider,
        erpSyncedAt: new Date(),
        erpError: null,
      },
    });
    await prisma.auditLog.create({
      data: {
        vendorId: target.id,
        onboardingCaseId: target.onboardingCaseId,
        actorId: actor.userId,
        action: "SAP_HANDOFF",
        detail: { sapVendorId: sap.sapVendorId, provider: sap.provider },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ERP sync failed";
    await prisma.vendor.update({
      where: { id: target.id },
      data: { erpStatus: "FAILED", erpProvider: mockSapClient.provider, erpError: message },
    });
    await prisma.auditLog.create({
      data: {
        vendorId: target.id,
        onboardingCaseId: target.onboardingCaseId,
        actorId: actor.userId,
        action: "ERP_SYNC_FAILED",
        detail: { error: message, provider: mockSapClient.provider },
      },
    });
    await safeNotify(() =>
      notifyRole("PROCUREMENT", {
        type: "ERP_SYNC_FAILED",
        title: `ERP handoff failed: ${target.legalName}`,
        body: message,
        vendorId: target.id,
        relatedType: "erp",
      }),
    );
  }
}

/** Procurement retries a failed (or not-yet-started) ERP handoff for a verified vendor. */
export async function retryErpSync(vendorId: string, actor: AuthContext): Promise<VendorDetailDTO> {
  if (actor.role !== "ADMIN" && actor.role !== "PROCUREMENT") {
    throw new ServiceError(403, "Only procurement can retry the ERP handoff");
  }
  const vendor = await loadVendorOrThrow(vendorId);
  if (vendor.status !== "VERIFIED") {
    throw new ServiceError(409, "ERP handoff is only available once the vendor is verified");
  }
  if (vendor.erpStatus === "SYNCED") throw new ServiceError(409, "Vendor is already synced to ERP");
  if (vendor.erpStatus === "PENDING") throw new ServiceError(409, "An ERP handoff is already in progress");

  const c = vendor.onboardingCase;
  await attemptErpSync(
    { id: vendor.id, legalName: vendor.legalName, pan: c?.pan ?? null, gstin: c?.gstin ?? null, onboardingCaseId: c?.id ?? null },
    actor,
  );
  return getVendorDetail(vendorId, actor);
}

// ---------------------------------------------------------------------------
// Documents (stored as Base64 in Neon, ≤ 1 MB original binary)
// ---------------------------------------------------------------------------

export interface DownloadableDocument {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

/** Upload (or replace) a vendor document. Binary is decoded, size-checked, and stored Base64. */
export async function uploadDocument(
  vendorId: string,
  input: UploadDocumentInput,
  actor: AuthContext,
): Promise<VendorDetailDTO> {
  const vendor = await loadVendorOrThrow(vendorId);
  if (!canEditVendor(vendor, actor)) throw new ServiceError(403, "You do not have access to this vendor");
  const c = vendor.onboardingCase;
  if (c?.status === "VERIFIED") throw new ServiceError(409, "Vendor is already verified");

  // Accept an optional data-URI prefix, then decode to validate the real byte size.
  const rawBase64 = input.dataBase64.replace(/^data:[^;]+;base64,/, "").trim();
  let buffer: Buffer;
  try {
    buffer = Buffer.from(rawBase64, "base64");
  } catch {
    throw new ServiceError(400, "File data is not valid Base64");
  }
  if (buffer.length === 0) throw new ServiceError(400, "File is empty");
  if (buffer.length > maxDocumentBytes) {
    throw new ServiceError(413, `File exceeds the 1 MB limit (${(buffer.length / 1024).toFixed(0)} KB)`);
  }

  // One current document per required type: replacing removes the prior one.
  const existing =
    input.type === "OTHER"
      ? []
      : await prisma.document.findMany({ where: { vendorId, type: input.type }, select: { id: true } });
  const isReplace = existing.length > 0;

  await prisma.$transaction(
    async (tx) => {
      if (existing.length > 0) {
        await tx.document.deleteMany({ where: { vendorId, type: input.type } });
      }
      const doc = await tx.document.create({
        data: {
          vendorId,
          type: input.type,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: buffer.length,
          dataBase64: buffer.toString("base64"),
          status: "PENDING",
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          uploadedById: actor.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          vendorId,
          onboardingCaseId: c?.id ?? null,
          actorId: actor.userId,
          action: isReplace ? "DOCUMENT_REPLACED" : "DOCUMENT_UPLOADED",
          detail: { type: input.type, fileName: input.fileName, sizeBytes: buffer.length, documentId: doc.id, by: actor.email },
        },
      });
    },
    { timeout: 30000, maxWait: 15000 },
  );

  return getVendorDetail(vendorId, actor);
}

export async function listDocuments(vendorId: string, actor: AuthContext): Promise<DocumentDTO[]> {
  const vendor = await loadDetailOrThrow(vendorId);
  assertVendorAccess(vendor, actor);
  return mapDocuments(vendor);
}

/** Load a document for download, enforcing that the caller may access its vendor. */
export async function getDocumentForDownload(documentId: string, actor: AuthContext): Promise<DownloadableDocument> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { vendor: { select: { contactEmail: true } } },
  });
  if (!doc) throw new ServiceError(404, "Document not found");
  assertVendorAccess(doc.vendor, actor);
  return { fileName: doc.fileName, mimeType: doc.mimeType, buffer: Buffer.from(doc.dataBase64, "base64") };
}

/** Procurement/Admin reviews (approves/rejects) an uploaded document. */
export async function reviewDocument(
  vendorId: string,
  documentId: string,
  input: ReviewDocumentInput,
  actor: AuthContext,
): Promise<VendorDetailDTO> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, vendorId: true, type: true, vendor: { select: { contactEmail: true } } },
  });
  if (!doc || doc.vendorId !== vendorId) throw new ServiceError(404, "Document not found for this vendor");

  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: { status: input.status, reviewNote: input.note ?? null, reviewedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          vendorId,
          actorId: actor.userId,
          action: "DOCUMENT_REVIEWED",
          detail: { documentId, status: input.status, note: input.note ?? null, by: actor.email },
        },
      });
    },
    { timeout: 30000, maxWait: 15000 },
  );

  if (input.status === "REJECTED") {
    await safeNotify(() =>
      notifyVendorContact(doc.vendor.contactEmail, {
        type: "DOCUMENT_REJECTED",
        title: `Document rejected: ${documentTypeLabels[doc.type]}`,
        body: input.note ?? "Please re-upload a corrected document.",
        vendorId,
        relatedType: "document",
        relatedId: documentId,
      }),
    );
  }

  return getVendorDetail(vendorId, actor);
}

/**
 * Procurement nudges the current owner (an approval function or the vendor).
 * A reminder is a persisted {@link Notification} plus an audit entry — no email
 * is actually sent (the email provider is mocked).
 */
export async function sendReminder(
  vendorId: string,
  input: RemindInput,
  actor: AuthContext,
): Promise<{ ok: true }> {
  if (actor.role !== "ADMIN" && actor.role !== "PROCUREMENT") {
    throw new ServiceError(403, "Only procurement can send reminders");
  }
  const vendor = await loadVendorOrThrow(vendorId);
  const c = vendor.onboardingCase;

  if (input.target === "VENDOR") {
    await notifyVendorContact(vendor.contactEmail, {
      type: "REMINDER",
      title: `Reminder: complete onboarding for ${vendor.legalName}`,
      body: "Please complete the pending onboarding steps so we can proceed.",
      vendorId: vendor.id,
      relatedType: "onboarding",
    });
  } else {
    const pending = c?.approvalTasks.some((t) => t.function === input.target && t.status === "PENDING");
    if (!pending) throw new ServiceError(409, `${input.target} has no pending approval for this vendor`);
    await notifyRole(input.target, {
      type: "REMINDER",
      title: `Reminder: approval pending for ${vendor.legalName}`,
      body: `${vendor.legalName} is awaiting your ${input.target} approval.`,
      vendorId: vendor.id,
      relatedType: "approval",
    });
  }

  await prisma.auditLog.create({
    data: {
      vendorId: vendor.id,
      actorId: actor.userId,
      action: "REMINDER_SENT",
      detail: { target: input.target, by: actor.email },
    },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Procurement control tower: metrics + pipeline (all counts real, from Neon)
// ---------------------------------------------------------------------------

const APPROVER_ROLES: UserRole[] = ["FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"];

function assertInternal(auth: AuthContext): void {
  if (!INTERNAL_ROLES.includes(auth.role)) {
    throw new ServiceError(403, "This resource is only available to internal users");
  }
}

export async function getProcurementMetrics(auth: AuthContext): Promise<ProcurementMetricsDTO> {
  assertInternal(auth);

  const atRiskThreshold = new Date(Date.now() - onboardingSlaDays * 0.75 * 86_400_000);
  const reworkActions = ["ONBOARDING_RESUBMITTED", "APPROVAL_CHANGES_REQUESTED", "DOCUMENT_REPLACED"];
  const [totalVendors, verifiedVendors, grouped, erpGrouped, slaAtRisk, reworkVendors, performanceAtRisk] =
    await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: "VERIFIED" } }),
      prisma.onboardingCase.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.vendor.groupBy({ by: ["erpStatus"], _count: { _all: true } }),
      prisma.onboardingCase.count({
        where: { status: { notIn: ["VERIFIED", "REJECTED"] }, createdAt: { lte: atRiskThreshold } },
      }),
      prisma.auditLog.findMany({
        where: { action: { in: reworkActions }, vendorId: { not: null } },
        distinct: ["vendorId"],
        select: { vendorId: true },
      }),
      countPerformanceAtRisk(),
    ]);

  const byStatus = new Map<string, number>();
  for (const g of grouped) byStatus.set(g.status, g._count._all);
  const n = (s: string) => byStatus.get(s) ?? 0;

  const byErp = new Map<string, number>();
  for (const g of erpGrouped) byErp.set(g.erpStatus, g._count._all);
  const erp = (s: string) => byErp.get(s) ?? 0;

  const awaitingVendor = n("CREATED") + n("VERIFICATION_FAILED") + n("CHANGES_REQUESTED");
  const verificationPending = n("INFO_SUBMITTED") + n("VERIFICATION_IN_PROGRESS");
  const verificationFailed = n("VERIFICATION_FAILED");
  const approvalPending = n("IN_APPROVAL");
  const verified = n("VERIFIED");
  const rejected = n("REJECTED");
  const inOnboarding = totalVendors - verified - rejected;

  const pipeline: ProcurementMetricsDTO["pipeline"] = [
    { stage: "CREATED", label: "Created", count: n("CREATED") },
    { stage: "INFO_SUBMITTED", label: "Info submitted", count: n("INFO_SUBMITTED") },
    {
      stage: "VERIFICATION",
      label: "Verification",
      count: n("VERIFICATION_IN_PROGRESS") + n("VERIFICATION_PASSED") + n("VERIFICATION_FAILED"),
    },
    { stage: "APPROVAL", label: "Approval", count: n("IN_APPROVAL") + n("CHANGES_REQUESTED") },
    { stage: "VERIFIED", label: "Verified", count: verified },
  ];

  return {
    totalVendors,
    inOnboarding,
    awaitingVendor,
    verificationPending,
    verificationFailed,
    approvalPending,
    verified: verifiedVendors,
    slaAtRisk,
    reworkRate: totalVendors > 0 ? Math.round((reworkVendors.length / totalVendors) * 100) : 0,
    erpPending: erp("PENDING"),
    erpFailed: erp("FAILED"),
    erpSynced: erp("SYNCED"),
    performanceAtRisk,
    pipeline,
  };
}

// ---------------------------------------------------------------------------
// Approver workspace: role-scoped approval queue
// ---------------------------------------------------------------------------

export type ApprovalQueueScope = "pending" | "completed" | "changes" | "all";

export async function listApprovalQueue(auth: AuthContext, scope: ApprovalQueueScope): Promise<ApprovalQueueItemDTO[]> {
  // Approvers see only their function; ADMIN/PROCUREMENT see all functions.
  const functionFilter: Prisma.ApprovalTaskWhereInput = APPROVER_ROLES.includes(auth.role)
    ? { function: auth.role as ApprovalFunction }
    : auth.role === "ADMIN" || auth.role === "PROCUREMENT"
      ? {}
      : (() => {
          throw new ServiceError(403, "Approval queue is only available to approvers and procurement");
        })();

  const statusFilter: Prisma.ApprovalTaskWhereInput =
    scope === "pending"
      ? { status: "PENDING" }
      : scope === "completed"
        ? { status: { in: ["APPROVED", "REJECTED"] } }
        : scope === "changes"
          ? { status: "CHANGES_REQUESTED" }
          : {};

  const tasks = await prisma.approvalTask.findMany({
    where: { ...functionFilter, ...statusFilter },
    orderBy: { createdAt: "asc" },
    include: { onboardingCase: { include: { vendor: { select: { id: true, legalName: true } } } } },
  });

  const now = Date.now();
  return tasks.map((t) => {
    const ageDays = Math.max(0, Math.floor((now - t.createdAt.getTime()) / 86_400_000));
    const slaDays = approvalSlaDays[t.function];
    return {
      taskId: t.id,
      vendorId: t.onboardingCase.vendor.id,
      vendorName: t.onboardingCase.vendor.legalName,
      function: t.function,
      status: t.status,
      onboardingStatus: t.onboardingCase.status,
      submittedAt: t.onboardingCase.submittedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      ageDays,
      slaDays,
      // Only pending tasks can breach SLA; completed ones are historical.
      overSla: t.status === "PENDING" && ageDays > slaDays,
      notes: t.notes,
    };
  });
}

// ---------------------------------------------------------------------------
// Global activity feed (internal users), sourced from AuditLog
// ---------------------------------------------------------------------------

export async function getActivityFeed(auth: AuthContext, limit = 100): Promise<ActivityFeedItemDTO[]> {
  assertInternal(auth);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: { actor: { select: { name: true } }, vendor: { select: { id: true, legalName: true } } },
  });
  return logs.map((a) => ({
    id: a.id,
    action: a.action,
    label: activityLabel(a.action),
    actorName: a.actor?.name ?? null,
    at: a.createdAt.toISOString(),
    vendorId: a.vendor?.id ?? null,
    vendorName: a.vendor?.legalName ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Vendor contacts (Primary / Finance / Quality / Commercial / Escalation)
// ---------------------------------------------------------------------------

export async function upsertVendorContact(
  vendorId: string,
  input: VendorContactInput,
  actor: AuthContext,
): Promise<VendorDetailDTO> {
  const vendor = await loadVendorOrThrow(vendorId);
  if (!canEditVendor(vendor, actor)) throw new ServiceError(403, "You do not have access to this vendor");
  await prisma.vendorContact.upsert({
    where: { vendorId_type: { vendorId, type: input.type } },
    create: { vendorId, type: input.type, name: input.name, email: input.email || null, phone: input.phone || null },
    update: { name: input.name, email: input.email || null, phone: input.phone || null },
  });
  return getVendorDetail(vendorId, actor);
}

export async function deleteVendorContact(
  vendorId: string,
  contactId: string,
  actor: AuthContext,
): Promise<VendorDetailDTO> {
  const vendor = await loadVendorOrThrow(vendorId);
  if (!canEditVendor(vendor, actor)) throw new ServiceError(403, "You do not have access to this vendor");
  await prisma.vendorContact.deleteMany({ where: { id: contactId, vendorId } });
  return getVendorDetail(vendorId, actor);
}
