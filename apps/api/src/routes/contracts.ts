import { Router } from "express";
import {
  createObligationSchema,
  updateContractStatusSchema,
  updateObligationSchema,
} from "@vendor-management/shared";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import {
  addObligation,
  listContracts,
  sweepContractRenewals,
  updateContractStatus,
  updateObligation,
} from "../services/contract-service.js";
import { ServiceError } from "../services/vendor-service.js";

export const contractsRouter = Router();
contractsRouter.use(requireAuth);

function handleError(error: unknown, response: import("express").Response): void {
  if (error instanceof ServiceError) {
    response.status(error.status).json({ success: false, error: error.message });
    return;
  }
  logger.error({ err: error }, "Contracts route error");
  response.status(500).json({ success: false, error: "Internal server error" });
}

// GET /api/contracts — all contracts (internal)
contractsRouter.get("/", async (request, response) => {
  try {
    response.json({ success: true, data: await listContracts(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/contracts/sweep-renewals — notify on contracts entering renewal window
contractsRouter.post("/sweep-renewals", async (request, response) => {
  try {
    if (request.auth!.role !== "ADMIN" && request.auth!.role !== "PROCUREMENT") {
      response.status(403).json({ success: false, error: "Forbidden" });
      return;
    }
    response.json({ success: true, data: { notified: await sweepContractRenewals() } });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/contracts/:id/status
contractsRouter.post("/:id/status", async (request, response) => {
  try {
    const input = updateContractStatusSchema.parse(request.body);
    response.json({ success: true, data: await updateContractStatus(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/contracts/:id/obligations
contractsRouter.post("/:id/obligations", async (request, response) => {
  try {
    const input = createObligationSchema.parse(request.body);
    response.json({ success: true, data: await addObligation(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/contracts/obligations/:id — update an obligation's status
contractsRouter.post("/obligations/:id", async (request, response) => {
  try {
    const input = updateObligationSchema.parse(request.body);
    response.json({ success: true, data: await updateObligation(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});
