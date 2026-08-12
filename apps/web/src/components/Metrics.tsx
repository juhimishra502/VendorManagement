import type { ProcurementMetricsDTO } from "@vendor-management/shared";
import { Card } from "./ui.js";

function Metric({ label, value, tone = "slate", suffix }: { label: string; value: number; tone?: string; suffix?: string }) {
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    amber: "text-amber-600",
    rose: "text-rose-600",
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
  };
  return (
    <Card className="p-4">
      <div className={`text-2xl font-semibold ${tones[tone]}`}>
        {value}
        {suffix && <span className="text-base">{suffix}</span>}
      </div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </Card>
  );
}

export function MetricsCards({ metrics }: { metrics: ProcurementMetricsDTO }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
      <Metric label="Total vendors" value={metrics.totalVendors} />
      <Metric label="In onboarding" value={metrics.inOnboarding} tone="indigo" />
      <Metric label="Awaiting vendor" value={metrics.awaitingVendor} tone="amber" />
      <Metric label="Verification pending" value={metrics.verificationPending} tone="amber" />
      <Metric label="Verification failed" value={metrics.verificationFailed} tone="rose" />
      <Metric label="Approval pending" value={metrics.approvalPending} tone="indigo" />
      <Metric label="SLA at risk" value={metrics.slaAtRisk} tone="rose" />
      <Metric label="Rework rate" value={metrics.reworkRate} suffix="%" tone="amber" />
      <Metric label="Verified" value={metrics.verified} tone="emerald" />
    </div>
  );
}

export function ErpMetricsCards({ metrics }: { metrics: ProcurementMetricsDTO }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Metric label="ERP synced" value={metrics.erpSynced} tone="emerald" />
      <Metric label="ERP handoff pending" value={metrics.erpPending} tone="amber" />
      <Metric label="ERP handoff failed" value={metrics.erpFailed} tone="rose" />
      <Metric label="Performance at risk" value={metrics.performanceAtRisk} tone="rose" />
    </div>
  );
}

export function Pipeline({ metrics }: { metrics: ProcurementMetricsDTO }) {
  const max = Math.max(1, ...metrics.pipeline.map((s) => s.count));
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Vendor pipeline</h2>
      <div className="flex items-stretch gap-2 overflow-x-auto">
        {metrics.pipeline.map((stage, i) => (
          <div key={stage.stage} className="flex items-center gap-2">
            <div className="min-w-[7rem] flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
              <div className="text-xl font-semibold text-slate-900">{stage.count}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">{stage.label}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(stage.count / max) * 100}%` }} />
              </div>
            </div>
            {i < metrics.pipeline.length - 1 && <span className="text-slate-300">→</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}
