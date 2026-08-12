import { Router } from "express";
import { assignRoleSchema, userRoles, type DevUserDTO } from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";

// DEVELOPMENT-ONLY router. It is only mounted when NODE_ENV !== "production"
// (see app.ts). As defence-in-depth, every handler also re-checks the guard so
// the endpoints can never mutate roles in a production deployment.
export const devRouter = Router();

function blockInProduction(response: import("express").Response): boolean {
  if (env.NODE_ENV === "production") {
    response.status(404).json({ success: false, error: "Not found" });
    return true;
  }
  return false;
}

devRouter.use(requireAuth);

// List users so the dev UI can pick who to re-role.
devRouter.get("/users", async (_request, response) => {
  if (blockInProduction(response)) return;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });
  response.json({ success: true, data: users satisfies DevUserDTO[] });
});

// Assign a role to an existing user. ADMIN is offered because the UserRole enum
// already defines it in the current schema.
devRouter.post("/assign-role", async (request, response) => {
  if (blockInProduction(response)) return;
  const parsed = assignRoleSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: "Validation failed", issues: parsed.error.issues });
    return;
  }
  if (!userRoles.includes(parsed.data.role)) {
    response.status(400).json({ success: false, error: "Unsupported role" });
    return;
  }

  const updated = await prisma.user
    .update({
      where: { id: parsed.data.userId },
      data: { role: parsed.data.role },
      select: { id: true, email: true, name: true, role: true },
    })
    .catch(() => null);

  if (!updated) {
    response.status(404).json({ success: false, error: "User not found" });
    return;
  }

  logger.info({ userId: updated.id, role: updated.role, by: request.auth?.email }, "DEV role assignment");
  response.json({ success: true, data: updated satisfies DevUserDTO });
});
