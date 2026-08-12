import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

export const meRouter = Router();

// Returns the authenticated user with their server-side role, so the frontend
// can tailor the UI. Authorization itself is always enforced server-side.
meRouter.get("/", requireAuth, (request, response) => {
  response.json({ success: true, data: request.auth });
});
