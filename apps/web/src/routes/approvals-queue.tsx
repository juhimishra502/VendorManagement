import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ApprovalQueueItemDTO } from "@vendor-management/shared";
import { listApprovalQueue, type ApprovalScope } from "../lib/operations.js";
import { useAuth } from "../lib/auth.js";
import { Badge, Card, ErrorText, StatusBadge } from "../components/ui.js";

const tabs: { scope: ApprovalScope; label: string }[] = [
  { scope: "pending", label: "Pending" },
  { scope: "completed", label: "Completed" },
  { scope: "changes", label: "Changes requested" },
];

export function ApproverQueuePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const scope = (params.get("scope") as ApprovalScope) || "pending";
  const [items, setItems] = useState<ApprovalQueueItemDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listApprovalQueue(scope)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load queue"))
      .finally(() => setLoading(false));
  }, [scope]);

  const isProcurement = user?.role === "ADMIN" || user?.role === "PROCUREMENT";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {isProcurement ? "Approvals" : `${user?.role} approvals`}
        </h1>
        <p className="text-sm text-slate-500">What needs a decision, and how long it has been waiting.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.scope}
            type="button"
            onClick={() => setParams(t.scope === "pending" ? {} : { scope: t.scope })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              scope === t.scope ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                {isProcurement && <th className="px-4 py-3">Function</th>}
                <th className="px-4 py-3">Onboarding</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">In queue / SLA</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={7}>
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                    {scope === "pending"
                      ? "Nothing waiting on you. 🎉"
                      : scope === "completed"
                        ? "No completed approvals yet."
                        : "No change requests."}
                  </td>
                </tr>
              ) : (
                items.map((t) => (
                  <tr key={t.taskId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/vendors/${t.vendorId}`} className="font-medium text-indigo-600 hover:underline">
                        {t.vendorName}
                      </Link>
                    </td>
                    {isProcurement && (
                      <td className="px-4 py-3">
                        <Badge tone="neutral">{t.function}</Badge>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <StatusBadge status={t.onboardingStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {t.submittedAt ? new Date(t.submittedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.ageDays}d <span className="text-slate-400">/ SLA {t.slaDays}d</span>
                      {t.overSla && (
                        <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700">
                          over SLA
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/vendors/${t.vendorId}`} className="text-sm font-medium text-indigo-600 hover:underline">
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
