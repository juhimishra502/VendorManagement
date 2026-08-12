import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ApprovalFunction, ApprovalTaskDTO, VendorDetailDTO } from "@vendor-management/shared";
import { completeApproval, getVendor } from "../lib/vendors.js";
import { useAuth } from "../lib/auth.js";
import { Badge, Button, Card, ErrorText, StatusBadge } from "../components/ui.js";

export function ApprovalsPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<VendorDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ApprovalFunction | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    getVendor(id)
      .then(setVendor)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load vendor"));
  }, [id]);

  useEffect(load, [load]);

  async function decide(fn: ApprovalFunction, decision: "APPROVED" | "REJECTED") {
    setError(null);
    setBusy(fn);
    try {
      setVendor(await completeApproval(id, fn, decision, notes[fn]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(null);
    }
  }

  if (!vendor) return <p className="text-slate-400">Loading…</p>;

  const canDecide = (task: ApprovalTaskDTO): boolean =>
    task.status === "PENDING" && vendor.onboardingStatus === "IN_APPROVAL" && (user?.role === "ADMIN" || user?.role === task.function);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={`/vendors/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← Back to vendor
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Approval workspace</h1>
        <StatusBadge status={vendor.onboardingStatus} />
      </div>
      <p className="text-sm text-slate-500">
        Finance, Tax, Legal and Quality review in parallel. You can only act on your own function. When all four approve,
        the vendor is verified and handed off to SAP automatically.
      </p>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {vendor.status === "VERIFIED" && (
        <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          ✓ All approvals complete. Vendor verified. SAP vendor ID <strong>{vendor.sapVendorId}</strong>.
        </Card>
      )}

      {vendor.approvals.length === 0 ? (
        <Card className="text-sm text-slate-400">Approval tasks are created after verification passes.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {vendor.approvals.map((task) => (
            <Card key={task.id}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{task.function}</span>
                <StatusBadge status={task.status} />
              </div>
              {task.decidedByName && (
                <p className="mt-1 text-xs text-slate-400">
                  {task.status.toLowerCase()} by {task.decidedByName}
                </p>
              )}
              {task.notes ? <p className="mt-1 text-sm text-slate-600">“{task.notes}”</p> : null}

              {canDecide(task) ? (
                <div className="mt-3 space-y-2">
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    placeholder="Notes (optional)"
                    value={notes[task.function] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [task.function]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" disabled={busy === task.function} onClick={() => decide(task.function, "APPROVED")}>
                      {busy === task.function ? "…" : "Approve"}
                    </Button>
                    <Button variant="danger" disabled={busy === task.function} onClick={() => decide(task.function, "REJECTED")}>
                      Reject
                    </Button>
                  </div>
                </div>
              ) : task.status === "PENDING" ? (
                <p className="mt-3 text-xs text-slate-400">
                  <Badge tone="neutral">Requires {task.function} role</Badge>
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
