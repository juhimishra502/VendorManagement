import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import {
  getActivityFeed,
  getProcurementMetrics,
  listApprovalQueue,
  ServiceError,
  type ApprovalQueueScope,
} from "../services/vendor-service.js";

// Read-only operational endpoints for the control tower and approver workspace.
export const opsRouter = Router();

opsRouter.use(requireAuth);

function handleError(error: unknown, response: import("express").Response): void {
  if (error instanceof ServiceError) {
    response.status(error.status).json({ success: false, error: error.message });
    return;
  }
  logger.error({ err: error }, "Operations route error");
  response.status(500).json({ success: false, error: "Internal server error" });
}

// GET /api/metrics — procurement control-tower counts + pipeline (internal only)
opsRouter.get("/metrics", async (request, response) => {
  try {
    response.json({ success: true, data: await getProcurementMetrics(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/approvals?scope=pending|completed|changes|all — role-scoped approval queue
const scopeSchema = z.enum(["pending", "completed", "changes", "all"]).default("pending");
opsRouter.get("/approvals", async (request, response) => {
  try {
    const scope = scopeSchema.parse(request.query.scope ?? "pending") as ApprovalQueueScope;
    response.json({ success: true, data: await listApprovalQueue(request.auth!, scope) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/activity — recent activity across vendors (internal only)
opsRouter.get("/activity", async (request, response) => {
  try {
    const limit = Number(request.query.limit ?? 100);
    response.json({ success: true, data: await getActivityFeed(request.auth!, Number.isFinite(limit) ? limit : 100) });
  } catch (error) {
    handleError(error, response);
  }
});
