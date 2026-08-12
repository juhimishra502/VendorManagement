import { useState } from "react";
import type { ApprovalFunction, UserRole, VendorDetailDTO } from "@vendor-management/shared";
import { completeApproval } from "../lib/vendors.js";
import { Button, Card, ErrorText, StatusBadge } from "./ui.js";

const APPROVER_ROLES = ["FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"] as const;

// Focused "current task" panel for an approver reviewing a vendor. Approve or
// request changes for THEIR function only. Server enforces the same rule.
export function ApproverActionPanel({
  vendor,
  role,
  onChange,
}: {
  vendor: VendorDetailDTO;
  role: UserRole;
  onChange: (v: VendorDetailDTO) => void;
}) {
  const [reason, setReason] = useState("");
  const [showChanges, setShowChanges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!APPROVER_ROLES.includes(role as (typeof APPROVER_ROLES)[number])) return null;
  const task = vendor.approvals.find((a) => a.function === role);
  if (!task) return null;

  const actionable = vendor.onboardingStatus === "IN_APPROVAL" && task.status === "PENDING";

  async function act(decision: "APPROVED" | "CHANGES_REQUESTED") {
    setError(null);
    if (decision === "CHANGES_REQUESTED" && reason.trim().length === 0) {
      setError("Please give a reason for the requested changes.");
      return;
    }
    setBusy(true);
    try {
      onChange(await completeApproval(vendor.id, role as ApprovalFunction, decision, reason.trim() || undefined));
      setShowChanges(false);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-indigo-200 bg-indigo-50/50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Your task · {role}</p>
          <p className="font-medium text-slate-900">{vendor.legalName}</p>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {task.notes && task.status !== "PENDING" && (
        <p className="mt-2 text-sm text-slate-600">Your note: “{task.notes}”</p>
      )}

      {actionable ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600">
            You are approving that the <strong>{role}</strong> requirements for this vendor are satisfied. Review the
            information, documents and verification below before deciding.
          </p>
          {error ? <ErrorText>{error}</ErrorText> : null}
          {!showChanges ? (
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => act("APPROVED")}>
                {busy ? "Working…" : "Approve"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setShowChanges(true)}>
                Request changes
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="What does the vendor need to correct? (required)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="danger" disabled={busy} onClick={() => act("CHANGES_REQUESTED")}>
                  {busy ? "Working…" : "Send request"}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setShowChanges(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          {task.status === "PENDING"
            ? "This vendor is not currently awaiting approvals."
            : `You have already recorded your decision (${task.status.toLowerCase().replace("_", " ")}).`}
        </p>
      )}
    </Card>
  );
}
