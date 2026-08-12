import type { AdminUserDTO, AlertSweepResultDTO, UserRole } from "@vendor-management/shared";
import { apiFetch, downloadFile } from "./http.js";

export function listUsers(): Promise<AdminUserDTO[]> {
  return apiFetch<AdminUserDTO[]>("/api/admin/users");
}

export function setUserRole(userId: string, role: UserRole): Promise<AdminUserDTO> {
  return apiFetch<AdminUserDTO>(`/api/admin/users/${userId}/role`, { method: "POST", body: JSON.stringify({ role }) });
}

export function runAlerts(): Promise<AlertSweepResultDTO> {
  return apiFetch<AlertSweepResultDTO>("/api/admin/run-alerts", { method: "POST" });
}

export function exportVendorsCsv(): Promise<void> {
  return downloadFile("/api/admin/export/vendors.csv", "vendors.csv");
}

export function exportInvoicesCsv(): Promise<void> {
  return downloadFile("/api/admin/export/invoices.csv", "invoices.csv");
}
