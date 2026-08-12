import { useState } from "react";
import { erpStatusLabels, type ErpStatus, type VendorDetailDTO } from "@vendor-management/shared";
import { retryErpSync } from "../lib/vendors.js";
import { Badge, Button, Card } from "./ui.js";

const erpTone: Record<ErpStatus, Parameters<typeof Badge>[0]["tone"]> = {
  NOT_STARTED: "neutral",
  PENDING: "progress",
  SYNCED: "success",
  FAILED: "danger",
};

// ERP / SAP vendor-master handoff status. Procurement can retry a failed sync.
export function ErpHandoffCard({
  vendor,
  canRetry,
  onChange,
}: {
  vendor: VendorDetailDTO;
  canRetry: boolean;
  onChange: (v: VendorDetailDTO) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const erp = vendor.erp;

  // Only relevant once a vendor reaches verification (handoff is post-approval).
  if (vendor.status !== "VERIFIED" && erp.status === "NOT_STARTED") return null;

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      onChange(await retryErpSync(vendor.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">ERP / SAP handoff</h2>
        <Badge tone={erpTone[erp.status]}>{erpStatusLabels[erp.status]}</Badge>
      </div>
      <dl className="space-y-1 text-sm">
        {erp.sapVendorId && (
          <div className="flex justify-between">
            <dt className="text-slate-500">SAP vendor ID</dt>
            <dd className="font-medium text-slate-800">{erp.sapVendorId}</dd>
          </div>
        )}
        {erp.provider && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Provider</dt>
            <dd className="text-slate-700">{erp.provider}</dd>
          </div>
        )}
        {erp.syncedAt && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Synced</dt>
            <dd className="text-slate-700">{new Date(erp.syncedAt).toLocaleString()}</dd>
          </div>
        )}
        {erp.lastAttemptAt && !erp.syncedAt && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Last attempt</dt>
            <dd className="text-slate-700">{new Date(erp.lastAttemptAt).toLocaleString()}</dd>
          </div>
        )}
      </dl>

      {erp.status === "FAILED" && erp.error && (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erp.error}</p>
      )}

      {canRetry && (erp.status === "FAILED" || erp.status === "NOT_STARTED") && (
        <div className="mt-3">
          <Button disabled={busy} onClick={() => void retry()}>
            {busy ? "Retrying…" : "Retry ERP handoff"}
          </Button>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}
