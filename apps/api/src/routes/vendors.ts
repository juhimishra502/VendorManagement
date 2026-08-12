import { Router } from "express";
import { z } from "zod";
import {
  approvalDecisionSchema,
  approvalFunctions,
  createContractSchema,
  createInvoiceSchema,
  createVendorSchema,
  recordReviewSchema,
  remindSchema,
  draftOnboardingSchema,
  reviewDocumentSchema,
  submitOnboardingSchema,
  uploadDocumentSchema,
  vendorContactSchema,
  type ApprovalFunction,
} from "@vendor-management/shared";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  completeApproval,
  createVendor,
  getVendorDetail,
  listDocuments,
  listVendors,
  retryErpSync,
  reviewDocument,
  runVerification,
  saveDraft,
  sendReminder,
  ServiceError,
  submitOnboarding,
  upsertVendorContact,
  deleteVendorContact,
  uploadDocument,
} from "../services/vendor-service.js";
import { sendInvitation } from "../services/invitation-service.js";
import { getScorecard, recordReview } from "../services/performance-service.js";
import { createInvoice, listInvoices } from "../services/invoice-service.js";
import { createContract, listContracts } from "../services/contract-service.js";

export const vendorsRouter = Router();

// Every vendor endpoint requires an authenticated Better Auth session.
vendorsRouter.use(requireAuth);

function isZodError(error: unknown): error is z.ZodError {
  // Detect structurally: the schema originates in @vendor-management/shared, which
  // may resolve a different Zod module instance, so `instanceof` alone is unreliable.
  return (
    error instanceof z.ZodError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: string }).name === "ZodError" &&
      Array.isArray((error as { issues?: unknown }).issues))
  );
}

function handleError(error: unknown, response: import("express").Response): void {
  if (error instanceof ServiceError) {
    response.status(error.status).json({ success: false, error: error.message });
    return;
  }
  if (isZodError(error)) {
    response.status(400).json({ success: false, error: "Validation failed", issues: error.issues });
    return;
  }
  logger.error({ err: error }, "Unhandled vendor route error");
  response.status(500).json({ success: false, error: "Internal server error" });
}

// GET /api/vendors — dashboard list (VENDOR sees only their own)
vendorsRouter.get("/", async (request, response) => {
  try {
    response.json({ success: true, data: await listVendors(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors — create vendor (Procurement/Admin only)
vendorsRouter.post("/", requireRole("ADMIN", "PROCUREMENT"), async (request, response) => {
  try {
    const input = createVendorSchema.parse(request.body);
    const vendor = await createVendor(input, request.auth!);
    response.status(201).json({ success: true, data: vendor });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/vendors/:id — vendor detail / status / portal data (access-scoped)
vendorsRouter.get("/:id", async (request, response) => {
  try {
    response.json({ success: true, data: await getVendorDetail(String(request.params.id), request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors/:id/invitations — send/resend onboarding invitation (Procurement/Admin)
vendorsRouter.post("/:id/invitations", requireRole("ADMIN", "PROCUREMENT"), async (request, response) => {
  try {
    const { token, expiresAt, email } = await sendInvitation(String(request.params.id), request.auth!);
    const link = `${env.CORS_ORIGIN}/onboard/${token}`;
    response.status(201).json({ success: true, data: { link, expiresAt: expiresAt.toISOString(), email } });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors/:id/onboarding/draft — save & resume partial onboarding (vendor/procurement)
vendorsRouter.post(
  "/:id/onboarding/draft",
  requireRole("ADMIN", "PROCUREMENT", "VENDOR"),
  async (request, response) => {
    try {
      const input = draftOnboardingSchema.parse(request.body);
      const vendor = await saveDraft(String(request.params.id), input, request.auth!);
      response.json({ success: true, data: vendor });
    } catch (error) {
      handleError(error, response);
    }
  },
);

// POST /api/vendors/:id/contacts — add/update a vendor contact (vendor or procurement)
vendorsRouter.post("/:id/contacts", requireRole("ADMIN", "PROCUREMENT", "VENDOR"), async (request, response) => {
  try {
    const input = vendorContactSchema.parse(request.body);
    response.status(201).json({ success: true, data: await upsertVendorContact(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// DELETE /api/vendors/:id/contacts/:contactId — remove a vendor contact
vendorsRouter.delete("/:id/contacts/:contactId", requireRole("ADMIN", "PROCUREMENT", "VENDOR"), async (request, response) => {
  try {
    const vendor = await deleteVendorContact(String(request.params.id), String(request.params.contactId), request.auth!);
    response.json({ success: true, data: vendor });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/vendors/:id/documents — list a vendor's documents (access-scoped)
vendorsRouter.get("/:id/documents", async (request, response) => {
  try {
    response.json({ success: true, data: await listDocuments(String(request.params.id), request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors/:id/documents — upload/replace a document (vendor or procurement)
vendorsRouter.post(
  "/:id/documents",
  requireRole("ADMIN", "PROCUREMENT", "VENDOR"),
  async (request, response) => {
    try {
      const input = uploadDocumentSchema.parse(request.body);
      const vendor = await uploadDocument(String(request.params.id), input, request.auth!);
      response.status(201).json({ success: true, data: vendor });
    } catch (error) {
      handleError(error, response);
    }
  },
);

// POST /api/vendors/:id/documents/:docId/review — approve/reject a document (Procurement/Admin)
vendorsRouter.post(
  "/:id/documents/:docId/review",
  requireRole("ADMIN", "PROCUREMENT"),
  async (request, response) => {
    try {
      const input = reviewDocumentSchema.parse(request.body);
      const vendor = await reviewDocument(String(request.params.id), String(request.params.docId), input, request.auth!);
      response.json({ success: true, data: vendor });
    } catch (error) {
      handleError(error, response);
    }
  },
);

// POST /api/vendors/:id/onboarding — vendor submits company/statutory/bank details
vendorsRouter.post(
  "/:id/onboarding",
  requireRole("ADMIN", "PROCUREMENT", "VENDOR"),
  async (request, response) => {
    try {
      const input = submitOnboardingSchema.parse(request.body);
      const vendor = await submitOnboarding(String(request.params.id), input, request.auth!);
      response.json({ success: true, data: vendor });
    } catch (error) {
      handleError(error, response);
    }
  },
);

// POST /api/vendors/:id/verify — run statutory verification (Procurement/Admin only)
vendorsRouter.post("/:id/verify", requireRole("ADMIN", "PROCUREMENT"), async (request, response) => {
  try {
    const vendor = await runVerification(String(request.params.id), request.auth!);
    response.json({ success: true, data: vendor });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors/:id/erp-sync — procurement retries a failed ERP/SAP handoff
vendorsRouter.post("/:id/erp-sync", requireRole("ADMIN", "PROCUREMENT"), async (request, response) => {
  try {
    const vendor = await retryErpSync(String(request.params.id), request.auth!);
    response.json({ success: true, data: vendor });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/vendors/:id/invoices — a vendor's invoices (internal)
vendorsRouter.get("/:id/invoices", async (request, response) => {
  try {
    response.json({ success: true, data: await listInvoices(request.auth!, String(request.params.id)) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors/:id/invoices — record an invoice + reconcile (finance/admin)
vendorsRouter.post("/:id/invoices", requireRole("ADMIN", "FINANCE"), async (request, response) => {
  try {
    const input = createInvoiceSchema.parse(request.body);
    response.json({ success: true, data: await createInvoice(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/vendors/:id/contracts — a vendor's contracts (internal)
vendorsRouter.get("/:id/contracts", async (request, response) => {
  try {
    response.json({ success: true, data: await listContracts(request.auth!, String(request.params.id)) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors/:id/contracts — create a contract (procurement/legal/admin)
vendorsRouter.post("/:id/contracts", requireRole("ADMIN", "PROCUREMENT", "LEGAL"), async (request, response) => {
  try {
    const input = createContractSchema.parse(request.body);
    response.json({ success: true, data: await createContract(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/vendors/:id/scorecard — internal-only supplier scorecard
vendorsRouter.get("/:id/scorecard", async (request, response) => {
  try {
    const data = await getScorecard(String(request.params.id), request.auth!);
    response.json({ success: true, data });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors/:id/performance-reviews — record a review (procurement/quality/admin)
vendorsRouter.post(
  "/:id/performance-reviews",
  requireRole("ADMIN", "PROCUREMENT", "QUALITY"),
  async (request, response) => {
    try {
      const input = recordReviewSchema.parse(request.body);
      const data = await recordReview(String(request.params.id), input, request.auth!);
      response.json({ success: true, data });
    } catch (error) {
      handleError(error, response);
    }
  },
);

// POST /api/vendors/:id/remind — procurement nudges the current owner (function or vendor)
vendorsRouter.post("/:id/remind", requireRole("ADMIN", "PROCUREMENT"), async (request, response) => {
  try {
    const input = remindSchema.parse(request.body);
    const result = await sendReminder(String(request.params.id), input, request.auth!);
    response.json({ success: true, data: result });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/vendors/:id/approvals/:function — approver completes their task
const approvalFunctionParam = z.enum(approvalFunctions);

vendorsRouter.post("/:id/approvals/:function", async (request, response) => {
  try {
    const fn = approvalFunctionParam.parse(String(request.params.function).toUpperCase()) as ApprovalFunction;
    // API-level authorization: only the matching function (or Admin) may decide.
    if (request.auth!.role !== "ADMIN" && request.auth!.role !== fn) {
      response.status(403).json({ success: false, error: `Forbidden: requires ${fn} or ADMIN role` });
      return;
    }
    const input = approvalDecisionSchema.parse(request.body);
    const vendor = await completeApproval(request.params.id, fn, input, request.auth!);
    response.json({ success: true, data: vendor });
  } catch (error) {
    handleError(error, response);
  }
});
