import { Router } from "express";
import { z } from "zod";
import { acceptInvitationSchema } from "@vendor-management/shared";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { ServiceError } from "../services/vendor-service.js";
import { acceptInvitation, claimInvitation } from "../services/invitation-service.js";

// Invitation open/claim endpoints. `accept` is public (token possession is the
// authorization); `claim` requires an authenticated session whose email matches.
export const onboardingRouter = Router();

function handleError(error: unknown, response: import("express").Response): void {
  if (error instanceof ServiceError) {
    response.status(error.status).json({ success: false, error: error.message });
    return;
  }
  if (error instanceof z.ZodError || (error as { name?: string })?.name === "ZodError") {
    response.status(400).json({ success: false, error: "Validation failed" });
    return;
  }
  logger.error({ err: error }, "Onboarding route error");
  response.status(500).json({ success: false, error: "Internal server error" });
}

// POST /api/onboarding/accept — validate token, mark opened, set IN_PROGRESS (public)
onboardingRouter.post("/accept", async (request, response) => {
  try {
    const { token } = acceptInvitationSchema.parse(request.body);
    response.json({ success: true, data: await acceptInvitation(token) });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/onboarding/claim — bind the signed-in user (matching email) to the vendor
onboardingRouter.post("/claim", requireAuth, async (request, response) => {
  try {
    const { token } = acceptInvitationSchema.parse(request.body);
    response.json({ success: true, data: await claimInvitation(token, request.auth!) });
  } catch (error) {
    handleError(error, response);
  }
});
