import { prisma } from "@vendor-management/db";
import type { NotificationDTO, NotificationType, UserRole } from "@vendor-management/shared";
import type { AuthContext } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

interface NotifyPayload {
  type: NotificationType;
  title: string;
  body?: string | null;
  vendorId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
}

async function notifyUsers(userIds: string[], p: NotifyPayload): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: p.type,
      title: p.title,
      body: p.body ?? null,
      vendorId: p.vendorId ?? null,
      relatedType: p.relatedType ?? null,
      relatedId: p.relatedId ?? null,
    })),
  });
}

export async function notifyRole(role: UserRole, p: NotifyPayload): Promise<void> {
  const users = await prisma.user.findMany({ where: { role }, select: { id: true } });
  await notifyUsers(
    users.map((u) => u.id),
    p,
  );
}

export async function notifyVendorContact(contactEmail: string | null, p: NotifyPayload): Promise<void> {
  if (!contactEmail) return;
  const user = await prisma.user.findFirst({
    where: { email: { equals: contactEmail, mode: "insensitive" }, role: "VENDOR" },
    select: { id: true },
  });
  if (user) await notifyUsers([user.id], p);
}

/** Notifications must never break the main flow. */
export async function safeNotify(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    logger.warn({ err: e }, "notification failed (non-fatal)");
  }
}

export async function listNotifications(auth: AuthContext, limit = 50): Promise<NotificationDTO[]> {
  const rows = await prisma.notification.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    include: { vendor: { select: { legalName: true } } },
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    vendorId: n.vendorId,
    vendorName: n.vendor?.legalName ?? null,
    relatedType: n.relatedType,
    relatedId: n.relatedId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function unreadCount(auth: AuthContext): Promise<number> {
  return prisma.notification.count({ where: { userId: auth.userId, read: false } });
}

export async function markNotificationRead(id: string, auth: AuthContext): Promise<void> {
  await prisma.notification.updateMany({ where: { id, userId: auth.userId }, data: { read: true } });
}

export async function markAllNotificationsRead(auth: AuthContext): Promise<void> {
  await prisma.notification.updateMany({ where: { userId: auth.userId, read: false }, data: { read: true } });
}
