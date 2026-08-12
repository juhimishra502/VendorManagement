import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { recordPaymentSchema } from "@vendor-management/shared";
import {
  getFinanceControl,
  getInvoiceDetail,
  getInvoiceSummary,
  getVendorLedger,
  getVendorReconciliation,
  listInvoices,
  loadInvoiceForDoc,
  recordPayment,
  setInvoiceStatus,
} from "../services/invoice-service.js";
import { buildInvoicePdf, buildLedgerXlsx, buildReconciliationXlsx } from "../lib/documents.js";
import { getVendorDetail, ServiceError } from "../services/vendor-service.js";

// Finance control center: invoices, reconciliation, and (later phases) tax/ledger.
export const financeRouter = Router();
financeRouter.use(requireAuth);

function handleError(error: unknown, response: import("express").Response): void {
  if (error instanceof ServiceError) {
    response.status(error.status).json({ success: false, error: error.message });
    return;
  }
  logger.error({ err: error }, "Finance route error");
  response.status(500).json({ success: false, error: "Internal server error" });
}

// GET /api/finance/invoices — all invoices (internal)
financeRouter.get("/invoices", async (request, response) => {
  try {
    response.json({ success: true, data: await listInvoices(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/finance/invoices/summary — control-center counts
financeRouter.get("/invoices/summary", async (request, response) => {
  try {
    response.json({ success: true, data: await getInvoiceSummary(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/finance/invoices/:id/status — approve or cancel (finance/admin)
const statusSchema = z.object({ status: z.enum(["APPROVED", "CANCELLED"]) });
financeRouter.post("/invoices/:id/status", async (request, response) => {
  try {
    const { status } = statusSchema.parse(request.body);
    response.json({ success: true, data: await setInvoiceStatus(String(request.params.id), status, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/finance/invoices/:id/payments — record a payment (bookkeeping; finance/admin)
financeRouter.post("/invoices/:id/payments", async (request, response) => {
  try {
    const input = recordPaymentSchema.parse(request.body);
    response.json({ success: true, data: await recordPayment(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/finance/control — exceptions + cash-leakage (finance/admin only)
financeRouter.get("/control", async (request, response) => {
  try {
    response.json({ success: true, data: await getFinanceControl(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/finance/vendors/:id/ledger — derived vendor ledger (internal)
financeRouter.get("/vendors/:id/ledger", async (request, response) => {
  try {
    response.json({ success: true, data: await getVendorLedger(String(request.params.id), request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/finance/vendors/:id/reconciliation — derived reconciliation rows (internal)
financeRouter.get("/vendors/:id/reconciliation", async (request, response) => {
  try {
    response.json({ success: true, data: await getVendorReconciliation(String(request.params.id), request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/finance/invoices/:id — single invoice detail (internal)
financeRouter.get("/invoices/:id", async (request, response) => {
  try {
    response.json({ success: true, data: await getInvoiceDetail(String(request.params.id), request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/finance/invoices/:id/pdf — downloadable tax invoice PDF
financeRouter.get("/invoices/:id/pdf", async (request, response) => {
  try {
    const inv = await loadInvoiceForDoc(String(request.params.id), request.auth!);
    const pdf = await buildInvoicePdf(inv);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${inv.invoiceNumber}.pdf"`);
    response.send(pdf);
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/finance/vendors/:id/ledger.xlsx — downloadable ledger workbook
financeRouter.get("/vendors/:id/ledger.xlsx", async (request, response) => {
  try {
    const vendorId = String(request.params.id);
    const [ledger, vendor] = await Promise.all([
      getVendorLedger(vendorId, request.auth!),
      getVendorDetail(vendorId, request.auth!),
    ]);
    const xlsx = await buildLedgerXlsx(ledger, vendor.legalName);
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", `attachment; filename="ledger-${vendor.legalName.replace(/\s+/g, "-")}.xlsx"`);
    response.send(xlsx);
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/finance/vendors/:id/reconciliation.xlsx — downloadable reconciliation workbook
financeRouter.get("/vendors/:id/reconciliation.xlsx", async (request, response) => {
  try {
    const vendorId = String(request.params.id);
    const [rows, vendor] = await Promise.all([
      getVendorReconciliation(vendorId, request.auth!),
      getVendorDetail(vendorId, request.auth!),
    ]);
    const xlsx = await buildReconciliationXlsx(rows, vendor.legalName);
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", `attachment; filename="reconciliation-${vendor.legalName.replace(/\s+/g, "-")}.xlsx"`);
    response.send(xlsx);
  } catch (error) {
    handleError(error, response);
  }
});
