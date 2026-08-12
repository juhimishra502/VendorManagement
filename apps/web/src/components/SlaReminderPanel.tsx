import { useState } from "react";
import type { RemindInput, SlaStatus, VendorDetailDTO } from "@vendor-management/shared";
import { remindVendor } from "../lib/notifications.js";
import { Badge, Button, Card } from "./ui.js";

const slaTone: Record<SlaStatus, Parameters<typeof Badge>[0]["tone"]> = {
  ON_TRACK: "success",
  AT_RISK: "progress",
  BREACHED: "danger",
  DONE: "neutral",
};

const slaLabel: Record<SlaStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  BREACHED: "SLA breached",
  DONE: "Complete",
};

// SLA / ageing panel. Procurement can nudge the current owner from here.
export function SlaReminderPanel({ vendor, canRemind }: { vendor: VendorDetailDTO; canRemind: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sla = vendor.sla;

  const pendingFns = vendor.approvals.filter((a) => a.status === "PENDING").map((a) => a.function);
  const vendorOwed = vendor.responsibleFunction === "VENDOR";

  async function remind(target: RemindInput["target"]) {
    setBusy(target);
    setError(null);
    try {
      await remindVendor(vendor.id, { target });
      setSent(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reminder");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">SLA & ageing</h2>
        <Badge tone={slaTone[sla.slaStatus]}>{slaLabel[sla.slaStatus]}</Badge>
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Open for</dt>
          <dd className="font-medium text-slate-800">
            {sla.onboardingAgeDays}d <span className="text-slate-400">/ {sla.slaDays}d target</span>
          </dd>
        </div>
        {sla.currentOwner && (
          <div className="flex justify-between">
            <dt className="text-slate-500">With</dt>
            <dd className="font-medium text-slate-800">{sla.currentOwner}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-slate-500">Waiting on vendor</dt>
          <dd className="font-medium text-slate-800">{sla.vendorPendingDays}d</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Waiting on internal</dt>
          <dd className="font-medium text-slate-800">{sla.buyerPendingDays}d</dd>
        </div>
      </dl>

      {canRemind && (vendorOwed || pendingFns.length > 0) && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Send a reminder</p>
          <div className="flex flex-wrap gap-2">
            {vendorOwed && (
              <Button variant="secondary" disabled={busy !== null} onClick={() => void remind("VENDOR")}>
                Remind vendor
              </Button>
            )}
            {pendingFns.map((fn) => (
              <Button key={fn} variant="secondary" disabled={busy !== null} onClick={() => void remind(fn)}>
                Remind {fn}
              </Button>
            ))}
          </div>
          {sent && <p className="mt-2 text-xs text-emerald-600">Reminder sent to {sent}.</p>}
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}
