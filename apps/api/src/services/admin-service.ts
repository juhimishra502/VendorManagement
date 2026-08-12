import { prisma } from "@vendor-management/db";
import {
  documentTypeLabels,
  type AdminUserDTO,
  type AlertSweepResultDTO,
  type SetUserRoleInput,
  type UserRole,
} from "@vendor-management/shared";
import type { AuthContext } from "../middleware/auth.js";
import { ServiceError } from "./vendor-service.js";
import { listInvoices } from "./invoice-service.js";
import { sweepContractRenewals } from "./contract-service.js";
import { notifyRole, notifyVendorContact, safeNotify } from "./notification-service.js";

const INTERNAL_ROLES: UserRole[] = ["ADMIN", "PROCUREMENT", "FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"];

function assertAdmin(a: AuthContext) {
  if (a.role !== "ADMIN") throw new ServiceError(403, "This action requires an admin");
}
function assertInternal(a: AuthContext) {
  if (!INTERNAL_ROLES.includes(a.role)) throw new ServiceError(403, "This resource is only available to internal users");
}

// ---------------------------------------------------------------------------
// User & role management (admin only)
// ---------------------------------------------------------------------------

export async function listUsers(actor: AuthContext): Promise<AdminUserDTO[]> {
  assertAdmin(actor);
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  return users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role as UserRole, createdAt: u.createdAt.toISOString() }));
}

export async function setUserRole(userId: string, input: SetUserRoleInput, actor: AuthContext): Promise<AdminUserDTO> {
  assertAdmin(actor);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target) throw new ServiceError(404, "User not found");

  // Never allow demoting the last remaining admin.
  if (target.role === "ADMIN" && input.role !== "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) throw new ServiceError(409, "Cannot change the role of the last remaining admin");
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: { role: input.role }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  await prisma.auditLog.create({
    data: { actorId: actor.userId, action: "ROLE_CHANGED", detail: { userId, from: target.role, to: input.role, by: actor.email } },
  });
  return { id: updated.id, name: updated.name, email: updated.email, role: updated.role as UserRole, createdAt: updated.createdAt.toISOString() };
}

// ---------------------------------------------------------------------------
// Alert sweeps: document expiry + contract renewal
// ---------------------------------------------------------------------------

/** Notify procurement + the vendor about documents expiring within 30 days or expired. */
async function sweepDocumentExpiry(): Promise<number> {
  const soon = new Date(Date.now() + 30 * 86_400_000);
  const docs = await prisma.document.findMany({
    where: { expiryDate: { not: null, lte: soon }, status: { not: "REJECTED" } },
    include: { vendor: { select: { legalName: true, contactEmail: true } } },
  });
  for (const d of docs) {
    const expired = d.expiryDate!.getTime() < Date.now();
    const title = `${expired ? "Document expired" : "Document expiring"}: ${documentTypeLabels[d.type]} — ${d.vendor.legalName}`;
    const body = `${documentTypeLabels[d.type]} ${expired ? "has expired" : `expires on ${d.expiryDate!.toLocaleDateString()}`}. Please renew.`;
    await safeNotify(async () => {
      await notifyRole("PROCUREMENT", { type: "REMINDER", title, body, vendorId: d.vendorId, relatedType: "document", relatedId: d.id });
      await notifyVendorContact(d.vendor.contactEmail, { type: "REMINDER", title, body, vendorId: d.vendorId, relatedType: "document", relatedId: d.id });
    });
  }
  return docs.length;
}

export async function runAlerts(actor: AuthContext): Promise<AlertSweepResultDTO> {
  if (actor.role !== "ADMIN" && actor.role !== "PROCUREMENT") {
    throw new ServiceError(403, "Only procurement or admin can run alerts");
  }
  const [contractsNotified, documentsNotified] = await Promise.all([sweepContractRenewals(), sweepDocumentExpiry()]);
  return { contractsNotified, documentsNotified };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export async function exportVendorsCsv(actor: AuthContext): Promise<string> {
  assertInternal(actor);
  const vendors = await prisma.vendor.findMany({
    orderBy: { createdAt: "asc" },
    include: { onboardingCase: { select: { status: true } } },
  });
  const rows = vendors.map((v) => [
    v.id, v.legalName, v.category ?? "", v.tier ?? "", v.status, v.onboardingCase?.status ?? "", v.erpStatus, v.sapVendorId ?? "", v.createdAt.toISOString(),
  ]);
  return toCsv(["id", "legalName", "category", "tier", "status", "onboardingStatus", "erpStatus", "sapVendorId", "createdAt"], rows);
}

export async function exportInvoicesCsv(actor: AuthContext): Promise<string> {
  assertInternal(actor);
  const invoices = await listInvoices(actor);
  const rows = invoices.map((i) => [
    i.invoiceNumber, i.vendorName ?? "", i.invoiceDate.slice(0, 10), i.currency, i.totalAmount, i.netPayable, i.amountPaid, i.outstanding, i.status, i.matchStatus ?? "", i.isMsme ? "MSME" : "", i.overdue ? "OVERDUE" : "",
  ]);
  return toCsv(["invoiceNumber", "vendor", "date", "currency", "total", "netPayable", "paid", "outstanding", "status", "match", "msme", "overdue"], rows);
}
