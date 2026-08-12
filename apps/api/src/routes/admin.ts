import { Router } from "express";
import { setUserRoleSchema } from "@vendor-management/shared";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import {
  exportInvoicesCsv,
  exportVendorsCsv,
  listUsers,
  runAlerts,
  setUserRole,
} from "../services/admin-service.js";
import { ServiceError } from "../services/vendor-service.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);

function handleError(error: unknown, response: import("express").Response): void {
  if (error instanceof ServiceError) {
    response.status(error.status).json({ success: false, error: error.message });
    return;
  }
  logger.error({ err: error }, "Admin route error");
  response.status(500).json({ success: false, error: "Internal server error" });
}

// GET /api/admin/users — list users (admin)
adminRouter.get("/users", async (request, response) => {
  try {
    response.json({ success: true, data: await listUsers(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/admin/users/:id/role — change a user's role (admin)
adminRouter.post("/users/:id/role", async (request, response) => {
  try {
    const input = setUserRoleSchema.parse(request.body);
    response.json({ success: true, data: await setUserRole(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/admin/run-alerts — sweep document expiry + contract renewals (admin/procurement)
adminRouter.post("/run-alerts", async (request, response) => {
  try {
    response.json({ success: true, data: await runAlerts(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/admin/export/vendors.csv — vendor export (internal)
adminRouter.get("/export/vendors.csv", async (request, response) => {
  try {
    const csv = await exportVendorsCsv(request.auth!);
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", 'attachment; filename="vendors.csv"');
    response.send(csv);
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/admin/export/invoices.csv — invoice export (internal)
adminRouter.get("/export/invoices.csv", async (request, response) => {
  try {
    const csv = await exportInvoicesCsv(request.auth!);
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", 'attachment; filename="invoices.csv"');
    response.send(csv);
  } catch (error) {
    handleError(error, response);
  }
});
