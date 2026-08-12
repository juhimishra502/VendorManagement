import type { VerificationSummaryItemDTO } from "@vendor-management/shared";

function Mark({ status }: { status: VerificationSummaryItemDTO["status"] }) {
  if (status === "PASSED") return <span className="text-emerald-600">✓</span>;
  if (status === "FAILED") return <span className="text-rose-600">✕</span>;
  if (status === "PENDING") return <span className="text-amber-500">…</span>;
  return <span className="text-slate-300">○</span>;
}

// Vendor-friendly verification results — no internal provider/API details.
export function VerificationSummary({ items }: { items: VerificationSummaryItemDTO[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.type} className="py-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-800">{item.label}</span>
            <span className="flex items-center gap-1.5 text-sm">
              <Mark status={item.status} />
              <span
                className={
                  item.status === "PASSED"
                    ? "text-emerald-700"
                    : item.status === "FAILED"
                      ? "text-rose-700"
                      : "text-slate-500"
                }
              >
                {item.plainMessage}
              </span>
            </span>
          </div>
          {item.status === "FAILED" && (
            <div className="mt-1.5 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <p>
                <span className="font-semibold">Reason:</span> {item.reason}
              </p>
              <p>
                <span className="font-semibold">Action:</span> {item.action}
              </p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
