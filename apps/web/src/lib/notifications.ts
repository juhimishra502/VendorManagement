import type { NotificationDTO, RemindInput } from "@vendor-management/shared";
import { apiFetch } from "./http.js";

export function listNotifications(limit = 50): Promise<NotificationDTO[]> {
  return apiFetch<NotificationDTO[]>(`/api/notifications?limit=${limit}`);
}

export function getUnreadCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>("/api/notifications/unread-count");
}

export function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/notifications/read-all", { method: "POST" });
}

export function remindVendor(vendorId: string, input: RemindInput): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/vendors/${vendorId}/remind`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
