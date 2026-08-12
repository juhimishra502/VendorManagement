import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProcurementMetricsDTO, VendorSummaryDTO } from "@vendor-management/shared";
import { listVendors } from "../lib/vendors.js";
import { getMetrics } from "../lib/operations.js";
import { canCreateVendor, useAuth } from "../lib/auth.js";
import { Button, ErrorText } from "../components/ui.js";
import { ErpMetricsCards, MetricsCards, Pipeline } from "../components/Metrics.js";
import { VendorTable } from "../components/VendorTable.js";

export function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ProcurementMetricsDTO | null>(null);
  const [vendors, setVendors] = useState<VendorSummaryDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMetrics(), listVendors()])
      .then(([m, v]) => {
        setMetrics(m);
        setVendors(v);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load control tower"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Procurement control tower</h1>
          <p className="text-sm text-slate-500">Where every vendor is, what’s blocking them, and who needs to act.</p>
        </div>
        {canCreateVendor(user?.role) && (
          <Link to="/vendors/new">
            <Button>+ New vendor</Button>
          </Link>
        )}
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}
      {loading ? (
        <p className="text-slate-400">Loading real-time metrics…</p>
      ) : metrics ? (
        <>
          <MetricsCards metrics={metrics} />
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
            <Pipeline metrics={metrics} />
            <ErpMetricsCards metrics={metrics} />
          </div>
          <VendorTable vendors={vendors} />
        </>
      ) : null}
    </div>
  );
}

export function VendorsPage() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<VendorSummaryDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listVendors()
      .then(setVendors)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load vendors"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Vendors</h1>
        {canCreateVendor(user?.role) && (
          <Link to="/vendors/new">
            <Button>+ New vendor</Button>
          </Link>
        )}
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {loading ? <p className="text-slate-400">Loading…</p> : <VendorTable vendors={vendors} />}
    </div>
  );
}
