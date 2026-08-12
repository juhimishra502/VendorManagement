import { Router } from "express";
import { z } from "zod";
import { createRequestSchema, requestToVendorSchema, updateRequestSchema } from "@vendor-management/shared";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { ServiceError } from "../services/vendor-service.js";
import {
  convertRequestToVendor,
  createRequest,
  getRequest,
  listRequests,
  updateRequest,
} from "../services/request-service.js";

export const requestsRouter = Router();
requestsRouter.use(requireAuth);

function handleError(error: unknown, response: import("express").Response): void {
  if (error instanceof ServiceError) {
    response.status(error.status).json({ success: false, error: error.message });
    return;
  }
  if (error instanceof z.ZodError || (error as { name?: string })?.name === "ZodError") {
    response.status(400).json({ success: false, error: "Validation failed", issues: (error as z.ZodError).issues });
    return;
  }
  logger.error({ err: error }, "Request route error");
  response.status(500).json({ success: false, error: "Internal server error" });
}

// GET /api/requests — Business sees own; Procurement/Admin see all
requestsRouter.get("/", async (request, response) => {
  try {
    response.json({ success: true, data: await listRequests(request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/requests — raise a vendor request (Business/Procurement/Admin)
requestsRouter.post("/", async (request, response) => {
  try {
    const input = createRequestSchema.parse(request.body);
    response.status(201).json({ success: true, data: await createRequest(input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/requests/:id
requestsRouter.get("/:id", async (request, response) => {
  try {
    response.json({ success: true, data: await getRequest(String(request.params.id), request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// PATCH /api/requests/:id — update status (Procurement/Admin)
requestsRouter.patch("/:id", async (request, response) => {
  try {
    const input = updateRequestSchema.parse(request.body);
    response.json({ success: true, data: await updateRequest(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/requests/:id/convert — create the vendor from a shortlisted request (Procurement/Admin)
requestsRouter.post("/:id/convert", async (request, response) => {
  try {
    const input = requestToVendorSchema.parse(request.body ?? {});
    response.status(201).json({ success: true, data: await convertRequestToVendor(String(request.params.id), input, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});
