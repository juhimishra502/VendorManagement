import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { VendorDetailDTO } from "@vendor-management/shared";
import { getVendor, runVerification } from "../lib/vendors.js";
import { useAuth } from "../lib/auth.js";
import { Button, Card, ErrorText, StatusBadge } from "../components/ui.js";

export function VerificationPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<VendorDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getVendor(id)
      .then(setVendor)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load vendor"));
  }, [id]);

  useEffect(load, [load]);

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      setVendor(await runVerification(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return <p className="text-slate-400">Loading…</p>;

  const canProcure = user?.role === "ADMIN" || user?.role === "PROCUREMENT";
  const canRun =
    canProcure &&
    (vendor.onboardingStatus === "INFO_SUBMITTED" || vendor.onboardingStatus === "VERIFICATION_FAILED");
  const notSubmitted = !vendor.submission?.submittedAt;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to={`/vendors/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← Back to vendor
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Verification status</h1>
        <StatusBadge status={vendor.onboardingStatus} />
      </div>
      <p className="text-sm text-slate-500">
        Runs PAN, GST, Udyam and bank checks through the verification providers. Results are stored against the case.
      </p>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Card>
        {vendor.checks.length === 0 ? (
          <p className="text-sm text-slate-400">
            {notSubmitted ? "Vendor details must be submitted before verification can run." : "Verification has not run yet."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {vendor.checks.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{c.type}</span>
                    <span className="text-xs text-slate-400">{c.provider}</span>
                  </div>
                  <p className="text-sm text-slate-500">{c.message}</p>
                  {c.reference ? <p className="text-xs text-slate-400">Ref: {c.reference}</p> : null}
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}

        {canRun && (
          <div className="mt-4">
            <Button onClick={verify} disabled={busy || notSubmitted}>
              {busy ? "Running checks…" : vendor.checks.length ? "Re-run verification" : "Run verification"}
            </Button>
          </div>
        )}

        {vendor.onboardingStatus === "IN_APPROVAL" && (
          <p className="mt-4 text-sm text-emerald-700">
            ✓ All checks passed. Finance, Tax, Legal and Quality approval tasks were created in parallel —{" "}
            <Link to={`/vendors/${id}/approvals`} className="text-indigo-600 hover:underline">
              open the approval workspace
            </Link>
            .
          </p>
        )}
      </Card>
    </div>
  );
}
