import { Router } from "express";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
} from "../services/notification-service.js";

// The signed-in user's own notification center.
export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

function handleError(error: unknown, response: import("express").Response): void {
  logger.error({ err: error }, "Notifications route error");
  response.status(500).json({ success: false, error: "Internal server error" });
}

// GET /api/notifications — recent notifications for the caller
notificationsRouter.get("/", async (request, response) => {
  try {
    const limit = Number(request.query.limit ?? 50);
    const data = await listNotifications(request.auth!, Number.isFinite(limit) ? limit : 50);
    response.json({ success: true, data });
  } catch (error) {
    handleError(error, response);
  }
});

// GET /api/notifications/unread-count — badge count for the header bell
notificationsRouter.get("/unread-count", async (request, response) => {
  try {
    response.json({ success: true, data: { count: await unreadCount(request.auth!) } });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/notifications/read-all — mark everything read
notificationsRouter.post("/read-all", async (request, response) => {
  try {
    await markAllNotificationsRead(request.auth!);
    response.json({ success: true, data: { ok: true } });
  } catch (error) {
    handleError(error, response);
  }
});

// POST /api/notifications/:id/read — mark one read
notificationsRouter.post("/:id/read", async (request, response) => {
  try {
    await markNotificationRead(request.params.id, request.auth!);
    response.json({ success: true, data: { ok: true } });
  } catch (error) {
    handleError(error, response);
  }
});
