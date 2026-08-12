import { z } from "zod";

export const notificationTypes = [
  "APPROVAL_PENDING",
  "VENDOR_ACTION_REQUIRED",
  "DOCUMENT_REJECTED",
  "VERIFICATION_FAILED",
  "SLA_APPROACHING",
  "SLA_BREACHED",
  "CONTRACT_RENEWAL",
  "PERFORMANCE_ISSUE",
  "FINANCE_EXCEPTION",
  "ERP_SYNC_FAILED",
  "REMINDER",
] as const;
export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  vendorId: string | null;
  vendorName: string | null;
  relatedType: string | null;
  relatedId: string | null;
  read: boolean;
  createdAt: string;
}

// Reminder target: an approval function or the vendor themselves.
export const remindSchema = z.object({
  target: z.enum(["FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY", "VENDOR"]),
});
export type RemindInput = z.infer<typeof remindSchema>;

export const slaStatuses = ["ON_TRACK", "AT_RISK", "BREACHED", "DONE"] as const;
export type SlaStatus = (typeof slaStatuses)[number];

export interface SlaSummaryDTO {
  onboardingAgeDays: number;
  vendorPendingDays: number;
  buyerPendingDays: number;
  currentOwner: string | null;
  slaDays: number;
  slaStatus: SlaStatus;
}
