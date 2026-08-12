import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ActivityFeedItemDTO } from "@vendor-management/shared";
import { getActivity } from "../lib/operations.js";
import { Card, ErrorText } from "../components/ui.js";

export function ActivityPage() {
  const [items, setItems] = useState<ActivityFeedItemDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivity(150)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load activity"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Activity</h1>
        <p className="text-sm text-slate-500">Everything that has happened across onboarding, newest first.</p>
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Card>
        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-slate-400">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                <div className="min-w-0">
                  <p className="text-slate-800">
                    <span className="font-medium">{a.label}</span>
                    {a.vendorId && a.vendorName ? (
                      <>
                        {" · "}
                        <Link to={`/vendors/${a.vendorId}`} className="text-indigo-600 hover:underline">
                          {a.vendorName}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.actorName ? `${a.actorName} · ` : ""}
                    {new Date(a.at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
