import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  supplierTierLabels,
  performanceBandLabels,
  type ApprovalStatus,
  type ContractDTO,
  type InvoiceDTO,
  type ReconciliationRowDTO,
  type VendorDetailDTO,
  type VendorLedgerDTO,
} from "@vendor-management/shared";
import { getVendor } from "../lib/vendors.js";
import { listVendorContracts } from "../lib/contracts.js";
import {
  downloadInvoicePdf,
  downloadLedgerXlsx,
  downloadReconciliationXlsx,
  getVendorLedger,
  getVendorReconciliation,
  listVendorInvoices,
} from "../lib/finance.js";
import { money } from "./finance.js";
import { ApiError } from "../lib/http.js";
import { useAuth } from "../lib/auth.js";
import { Badge, Button, Card, ErrorText, StatusBadge } from "../components/ui.js";
import { OnboardingProgress } from "../components/Progress.js";
import { VerificationSummary } from "../components/VerificationSummary.js";
import { DocumentsPanel } from "../components/DocumentsPanel.js";
import { ApproverActionPanel } from "../components/ApproverActionPanel.js";
import { ContactsPanel } from "../components/ContactsPanel.js";
import { InviteModal } from "../components/InviteModal.js";
import { ErpHandoffCard } from "../components/ErpHandoffCard.js";
import { SlaReminderPanel } from "../components/SlaReminderPanel.js";
import { ScorecardPanel } from "../components/ScorecardPanel.js";
import { ContractsPanel } from "../components/ContractsPanel.js";

// ---------------------------------------------------------------------------
// Shared presentational helpers
// ---------------------------------------------------------------------------
type ChipState = "done" | "pending" | "exception" | "na";
const CHIP: Record<ChipState, { glyph: string; cls: string }> = {
  done: { glyph: "✓", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  pending: { glyph: "◷", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  exception: { glyph: "!", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  na: { glyph: "–", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};

function StatusCard({ icon, label, value, state, to }: { icon: string; label: string; value: string; state: ChipState; to?: string }) {
  const c = CHIP[state];
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-indigo-300 hover:shadow-sm">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-base ring-1 ring-inset ${c.cls}`} aria-hidden>{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="flex items-center gap-1 truncate text-sm font-semibold text-slate-800"><span className="text-xs">{c.glyph}</span> {value}</div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

// Neutral, restrained financial stat card (no saturated blue blocks).
function FinStat({ label, value, tone = "neutral", onClick }: { label: string; value: string; tone?: "neutral" | "green" | "red" | "amber"; onClick?: () => void }) {
  const color = { neutral: "text-slate-900", green: "text-emerald-600", red: "text-rose-600", amber: "text-amber-600" }[tone];
  return (
    <button onClick={onClick} className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</div>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value ?? "—"}</span>
    </div>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}
const money0 = (n: number) => money(Math.round(n));

// ---------------------------------------------------------------------------
// Vendor Profile (workspace)
// ---------------------------------------------------------------------------
type TabKey = "overview" | "information" | "finance" | "performance" | "contracts" | "documents" | "approvals" | "activity";

export function VendorDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [vendor, setVendor] = useState<VendorDetailDTO | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceDTO[] | null>(null);
  const [contracts, setContracts] = useState<ContractDTO[] | null>(null);

  const isInternal = !!user && user.role !== "VENDOR";
  const isProcurement = user?.role === "ADMIN" || user?.role === "PROCUREMENT";

  const load = useCallback(() => {
    getVendor(id)
      .then(setVendor)
      .catch((e) => setError({ status: e instanceof ApiError ? e.status : 0, message: e instanceof Error ? e.message : "Failed to load" }))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!id || !isInternal) return;
    listVendorInvoices(id).then(setInvoices).catch(() => setInvoices([]));
    listVendorContracts(id).then(setContracts).catch(() => setContracts([]));
  }, [id, isInternal]);

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (error) {
    const msg = error.status === 403 ? "You don’t have access to this vendor." : error.status === 404 ? "Vendor not found." : error.message;
    return (
      <div className="mx-auto max-w-lg">
        <ErrorText>{msg}</ErrorText>
        <Link to="/vendors" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">← Back to vendors</Link>
      </div>
    );
  }
  if (!vendor) return null;

  const tab = (params.get("tab") as TabKey) || "overview";
  const setTab = (t: TabKey) => { params.set("tab", t); setParams(params); };
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "information", label: "Information" },
    ...(isInternal ? ([{ key: "finance", label: "Finance" }, { key: "performance", label: "Performance" }, { key: "contracts", label: "Contracts" }] as const) : []),
    { key: "documents", label: "Documents" },
    ...(isInternal ? ([{ key: "approvals", label: "Approvals" }] as const) : []),
    { key: "activity", label: "Activity" },
  ];

  const exceptionCount = (invoices ?? []).filter((i) => i.status === "EXCEPTION" || i.overdue).length;
  const band = vendor.scorecard?.band;

  return (
    <div className="space-y-5">
      <Link to="/vendors" className="text-sm text-indigo-600 hover:underline">← Back to vendors</Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{vendor.legalName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {vendor.tier && <Badge tone="info">{supplierTierLabels[vendor.tier]}</Badge>}
              <span>{vendor.category ?? "Uncategorised"}</span>
              <StatusBadge status={vendor.status} />
              <StatusBadge status={vendor.onboardingStatus} />
              {band && <Badge tone={band === "AT_RISK" ? "danger" : band === "FAIR" ? "progress" : "success"}>Perf: {performanceBandLabels[band]}</Badge>}
              {exceptionCount > 0 && <Badge tone="danger">! {exceptionCount} finance exception{exceptionCount > 1 ? "s" : ""}</Badge>}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <Meta label="SAP ID" value={vendor.sapVendorId ?? "—"} />
            <Meta label="Overall score" value={vendor.scorecard?.overallScore != null ? `${vendor.scorecard.overallScore}/100` : "—"} />
            <Meta label="Updated" value={new Date(vendor.updatedAt).toLocaleDateString()} />
            <Meta label="Vendor ID" value={vendor.id.slice(0, 12)} />
            <Meta label="Primary contact" value={vendor.submission?.contactName ?? "—"} />
            <Meta label="Location" value={[vendor.submission?.city, vendor.submission?.state].filter(Boolean).join(", ") || "—"} />
          </dl>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab */}
      {tab === "overview" && <OverviewTab vendor={vendor} invoices={invoices} contracts={contracts} setTab={setTab} isInternal={isInternal} user={user} setVendor={setVendor} />}
      {tab === "information" && <InformationTab vendor={vendor} isProcurement={isProcurement} isInternal={isInternal} onInvite={() => setShowInvite(true)} onChange={setVendor} user={user} />}
      {tab === "finance" && isInternal && <FinanceTab vendor={vendor} invoices={invoices} contracts={contracts} setTab={setTab} />}
      {tab === "performance" && isInternal && <ScorecardPanel vendor={vendor} canRecord={isProcurement || user?.role === "QUALITY"} onRecorded={load} />}
      {tab === "contracts" && isInternal && <ContractsPanel vendorId={vendor.id} canManage={isProcurement || user?.role === "LEGAL"} />}
      {tab === "documents" && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Documents</h2>
          <DocumentsPanel vendor={vendor} canEdit={vendor.viewerCanEdit} canReview={isProcurement} onChange={setVendor} />
        </Card>
      )}
      {tab === "approvals" && isInternal && <ApprovalsTab vendor={vendor} user={user} onChange={setVendor} />}
      {tab === "activity" && <Card><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Activity timeline</h2><ActivityList items={vendor.activity} /></Card>}

      {showInvite && <InviteModal vendor={vendor} onClose={() => setShowInvite(false)} onSent={load} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OVERVIEW — analytics-first
// ---------------------------------------------------------------------------
function OverviewTab({ vendor, invoices, contracts, setTab, isInternal, user, setVendor }: {
  vendor: VendorDetailDTO; invoices: InvoiceDTO[] | null; contracts: ContractDTO[] | null;
  setTab: (t: TabKey) => void; isInternal: boolean; user: ReturnType<typeof useAuth>["user"]; setVendor: (v: VendorDetailDTO) => void;
}) {
  const navigate = useNavigate();
  const go = (q: string) => navigate(`/vendors/${vendor.id}?${q}`);
  const [ledger, setLedger] = useState<VendorLedgerDTO | null>(null);
  useEffect(() => { if (isInternal) getVendorLedger(vendor.id).then(setLedger).catch(() => {}); }, [vendor.id, isInternal]);

  const sc = vendor.scorecard;
  const band = sc?.band;
  const verifState: ChipState = vendor.checks.length === 0 ? "na" : vendor.checks.some((c) => c.status === "FAILED") ? "exception" : vendor.checks.every((c) => c.status === "PASSED") ? "done" : "pending";
  const apprState: ChipState = vendor.approvals.length === 0 ? "na" : vendor.approvals.some((a) => a.status === "REJECTED" || a.status === "CHANGES_REQUESTED") ? "exception" : vendor.approvals.every((a) => a.status === "APPROVED") ? "done" : "pending";
  const activeContract = (contracts ?? []).find((c) => c.status === "ACTIVE");
  const perfState: ChipState = !band ? "na" : band === "AT_RISK" ? "exception" : band === "FAIR" ? "pending" : "done";
  const slaState: ChipState = vendor.sla.slaStatus === "BREACHED" ? "exception" : vendor.sla.slaStatus === "AT_RISK" ? "pending" : "done";

  // ---- Analytics (all derived from existing vendor/finance/perf data) ----
  const inv = invoices ?? [];
  const exceptions = inv.filter((i) => i.status === "EXCEPTION" || i.overdue);
  const totalInvoiced = inv.reduce((a, i) => a + i.totalAmount, 0);
  const totalPaid = inv.reduce((a, i) => a + i.amountPaid, 0);
  const outstanding = inv.reduce((a, i) => a + i.outstanding, 0);
  const overdueInvs = inv.filter((i) => i.overdue);
  const overdueAmount = overdueInvs.reduce((a, i) => a + i.outstanding, 0);
  const exceptionValue = exceptions.reduce((a, i) => a + i.totalAmount, 0);

  // Payment performance: join payments (with due dates from invoices)
  const invByNum = new Map(inv.map((i) => [i.invoiceNumber, i]));
  let onTime = 0, payCount = 0, delaySum = 0;
  for (const p of ledger?.payments ?? []) {
    const i = p.invoiceNumber ? invByNum.get(p.invoiceNumber) : undefined;
    if (!i?.dueDate) continue;
    payCount++;
    const diff = Math.round((new Date(p.paymentDate).getTime() - new Date(i.dueDate).getTime()) / 86_400_000);
    if (diff <= 0) onTime++;
    delaySum += diff;
  }
  const onTimeRate = payCount ? Math.round((onTime / payCount) * 100) : null;
  const avgDelay = payCount ? Math.round(delaySum / payCount) : null;
  const paidPct = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  // Risk indicators
  const financeRisk: RiskLevel = inv.length === 0 ? "na" : exceptions.length >= 3 ? "high" : exceptions.length > 0 ? "med" : "low";
  const perfRisk: RiskLevel = !band ? "na" : band === "AT_RISK" ? "high" : band === "FAIR" ? "med" : "low";
  const complianceRisk: RiskLevel = vendor.onboardingStatus === "VERIFICATION_FAILED" ? "high" : verifState === "pending" ? "med" : verifState === "done" ? "low" : "na";
  const contractRisk: RiskLevel = !activeContract ? "na" : activeContract.expired ? "high" : activeContract.renewalDue ? "med" : "low";

  // Attention items (compact, actionable)
  const alerts: { text: string; go: () => void }[] = [];
  if (vendor.onboardingStatus === "VERIFICATION_FAILED") alerts.push({ text: "Verification failed — correction required", go: () => setTab("information") });
  if (apprState === "pending") alerts.push({ text: "Internal approvals pending", go: () => setTab("approvals") });
  if (apprState === "exception") alerts.push({ text: "Approval rejected / changes requested", go: () => setTab("approvals") });
  if (exceptions.some((i) => i.status === "EXCEPTION")) alerts.push({ text: `${exceptions.filter((i) => i.status === "EXCEPTION").length} reconciliation exception(s)`, go: () => go("tab=finance&fin=reconciliation") });
  if (overdueInvs.length) alerts.push({ text: `${overdueInvs.length} overdue invoice(s) · ${money0(overdueAmount)}`, go: () => go("tab=finance&fin=invoices") });
  if (activeContract?.renewalDue) alerts.push({ text: `Contract renewal in ${activeContract.daysToExpiry} days`, go: () => setTab("contracts") });
  if (activeContract?.expired) alerts.push({ text: "Contract expired — renewal overdue", go: () => setTab("contracts") });
  if (perfState === "exception") alerts.push({ text: "Performance at risk", go: () => setTab("performance") });

  return (
    <div className="space-y-5">
      {/* Vendor status / health */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatusCard icon="🏢" label="Vendor status" value={vendor.status} state={vendor.status === "VERIFIED" ? "done" : vendor.status === "REJECTED" ? "exception" : "pending"} />
        <StatusCard icon="📄" label="Onboarding" value={vendor.onboardingStatus?.replace(/_/g, " ") ?? "—"} state={vendor.onboardingStatus === "VERIFIED" ? "done" : vendor.onboardingStatus === "VERIFICATION_FAILED" || vendor.onboardingStatus === "REJECTED" ? "exception" : "pending"} to={`/vendors/${vendor.id}?tab=information`} />
        <StatusCard icon="🛡" label="Verification" value={`${vendor.completedChecks}/${vendor.totalChecks || 4} passed`} state={verifState} to={`/vendors/${vendor.id}?tab=information`} />
        {isInternal && <StatusCard icon="📊" label="Performance" value={band ? `${sc?.overallScore}/100 · ${performanceBandLabels[band]}` : "No score"} state={perfState} to={`/vendors/${vendor.id}?tab=performance`} />}
        {isInternal && <StatusCard icon="💰" label="Finance" value={exceptions.length ? `${exceptions.length} exception${exceptions.length > 1 ? "s" : ""}` : inv.length ? "Healthy" : "No invoices"} state={exceptions.length ? "exception" : inv.length ? "done" : "na"} to={`/vendors/${vendor.id}?tab=finance`} />}
        <StatusCard icon="⏱" label="SLA / ageing" value={`${vendor.sla.slaStatus.replace(/_/g, " ")} · ${vendor.sla.onboardingAgeDays}d`} state={slaState} />
      </div>

      {user && <ApproverActionPanel vendor={vendor} role={user.role} onChange={setVendor} />}

      {/* PRIMARY: Performance score */}
      {isInternal && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Performance score</h2>
            <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setTab("performance")}>View full scorecard →</button>
          </div>
          {sc?.hasData ? (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-slate-900">{sc.overallScore}</span>
                <span className="text-lg text-slate-400">/100</span>
                {band && <Badge tone={band === "AT_RISK" ? "danger" : band === "FAIR" ? "progress" : "success"}>{performanceBandLabels[band]}</Badge>}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
                <ScoreDim label="Quality" v={sc.dimensions.quality} />
                <ScoreDim label="Delivery" v={sc.dimensions.delivery} />
                <ScoreDim label="Cost" v={sc.dimensions.cost} />
                <ScoreDim label="Responsiveness" v={sc.dimensions.responsiveness} />
              </div>
            </div>
          ) : <p className="text-sm text-slate-400">No performance reviews recorded yet.</p>}
        </Card>
      )}

      {/* Vendor Analytics — compact, subordinate to the score */}
      {isInternal && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Vendor Analytics</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* A. Financial health */}
            <AnalyticsCard title="Financial health" onClick={() => go("tab=finance&fin=overview")}>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Contract value" value={activeContract?.value != null ? money0(activeContract.value) : "—"} />
                <Stat label="Paid" value={money0(totalPaid)} tone="green" />
                <Stat label="Outstanding" value={money0(outstanding)} tone={outstanding > 0 ? "red" : "neutral"} />
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>Paid {paidPct}%</span><span>of ₹{money0(totalInvoiced).slice(1)}</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
                </div>
              </div>
            </AnalyticsCard>

            {/* B. Payment performance */}
            <AnalyticsCard title="Payment performance" onClick={() => go("tab=finance&fin=invoices")}>
              {payCount === 0 ? <p className="text-sm text-slate-400">No payment history yet.</p> : (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="On-time rate" value={`${onTimeRate}%`} tone={onTimeRate != null && onTimeRate >= 85 ? "green" : onTimeRate != null && onTimeRate >= 60 ? "amber" : "red"} />
                  <Stat label="Avg vs due" value={avgDelay != null ? (avgDelay <= 0 ? `${-avgDelay}d early` : `${avgDelay}d late`) : "—"} tone={avgDelay != null && avgDelay > 0 ? "amber" : "green"} />
                  <Stat label="Overdue invoices" value={String(overdueInvs.length)} tone={overdueInvs.length ? "red" : "neutral"} />
                  <Stat label="Overdue amount" value={money0(overdueAmount)} tone={overdueAmount ? "red" : "neutral"} />
                </div>
              )}
            </AnalyticsCard>

            {/* C. Performance trend */}
            <AnalyticsCard title="Performance trend" onClick={() => setTab("performance")}>
              {sc && sc.trend.length >= 2 ? (
                <div className="flex items-center gap-4">
                  <Sparkline points={sc.trend.map((t) => t.overallScore)} />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {sc.trend.map((t) => <span key={t.period}>{t.period.replace(/^\d{4}-/, "")} <span className="font-semibold text-slate-800">{t.overallScore}</span></span>)}
                  </div>
                </div>
              ) : <p className="text-sm text-slate-400">Not enough history for a trend.</p>}
            </AnalyticsCard>

            {/* D. Risk indicators */}
            <AnalyticsCard title="Risk indicators">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <RiskRow label="Finance" level={financeRisk} />
                <RiskRow label="Performance" level={perfRisk} />
                <RiskRow label="Compliance" level={complianceRisk} />
                <RiskRow label="Contract" level={contractRisk} />
              </div>
            </AnalyticsCard>

            {/* E. Contract health */}
            <AnalyticsCard title="Contract health" onClick={() => setTab("contracts")}>
              {activeContract ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Value" value={activeContract.value != null ? money0(activeContract.value) : "—"} />
                    <Stat label="Days left" value={activeContract.expired ? "Overdue" : String(activeContract.daysToExpiry)} tone={activeContract.expired ? "red" : activeContract.renewalDue ? "amber" : "green"} />
                    <Stat label="Auto-renew" value={activeContract.autoRenew ? "Yes" : "No"} />
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] text-slate-500">Renews {new Date(activeContract.endDate).toLocaleDateString()}</div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${activeContract.expired ? "bg-rose-500" : activeContract.renewalDue ? "bg-amber-500" : "bg-indigo-400"}`} style={{ width: `${Math.max(4, Math.min(100, 100 - (activeContract.daysToExpiry / (activeContract.renewalNoticeDays * 4 || 360)) * 100))}%` }} />
                    </div>
                  </div>
                </>
              ) : <p className="text-sm text-slate-400">No active contract.</p>}
            </AnalyticsCard>

            {/* F. Attention required */}
            <AnalyticsCard title="Attention required">
              {alerts.length === 0 && !vendor.currentBlocker ? (
                <p className="text-sm text-emerald-600">No open issues.</p>
              ) : (
                <ul className="space-y-1.5">
                  {vendor.currentBlocker && <li className="text-xs text-slate-600"><span className="font-semibold text-slate-700">Blocker:</span> {vendor.currentBlocker}</li>}
                  {alerts.map((a, i) => (
                    <li key={i}>
                      <button onClick={a.go} className="flex w-full items-center gap-2 text-left text-sm text-slate-700 hover:text-indigo-700">
                        <span className="text-rose-500">!</span> <span className="truncate">{a.text}</span> <span className="ml-auto shrink-0 text-xs text-indigo-500">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </AnalyticsCard>
          </div>
        </div>
      )}

      {/* High-level recent activity (small preview) */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent activity</h2>
          <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setTab("activity")}>View activity →</button>
        </div>
        <ActivityList items={vendor.activity.slice(0, 5)} />
      </Card>
    </div>
  );
}

// Analytics helper primitives
type RiskLevel = "low" | "med" | "high" | "na";
function AnalyticsCard({ title, onClick, children }: { title: string; onClick?: () => void; children: ReactNode }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${onClick ? "cursor-pointer transition hover:border-indigo-300 hover:shadow-sm" : ""}`} onClick={onClick}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {onClick && <span className="text-xs text-indigo-500">→</span>}
      </div>
      {children}
    </div>
  );
}
function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "red" | "amber" }) {
  const c = { neutral: "text-slate-900", green: "text-emerald-600", red: "text-rose-600", amber: "text-amber-600" }[tone];
  return <div><div className={`text-sm font-semibold ${c}`}>{value}</div><div className="text-[11px] text-slate-400">{label}</div></div>;
}
function ScoreDim({ label, v }: { label: string; v: number | null }) {
  const pct = v ?? 0;
  return (
    <div>
      <div className="flex items-baseline justify-between"><span className="text-xs text-slate-500">{label}</span><span className="text-sm font-semibold text-slate-800">{v ?? "—"}</span></div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pct < 60 ? "bg-rose-400" : pct < 75 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
const RISK: Record<RiskLevel, { dot: string; label: string }> = {
  low: { dot: "bg-emerald-500", label: "Low" }, med: { dot: "bg-amber-500", label: "Medium" },
  high: { dot: "bg-rose-500", label: "High" }, na: { dot: "bg-slate-300", label: "N/A" },
};
function RiskRow({ label, level }: { label: string; level: RiskLevel }) {
  const r = RISK[level];
  return <div className="flex items-center justify-between"><span className="text-slate-600">{label}</span><span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} /> <span className="text-xs font-medium text-slate-700">{r.label}</span></span></div>;
}
function Sparkline({ points }: { points: number[] }) {
  const w = 96, h = 34, pad = 3;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i * (w - 2 * pad)) / Math.max(1, points.length - 1);
    const y = h - pad - ((p - min) / range) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1], first = points[0];
  const stroke = last >= first ? "#059669" : "#e11d48";
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={coords.join(" ")} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => { const [x, y] = c.split(","); return <circle key={i} cx={x} cy={y} r="1.6" fill={stroke} />; })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// INFORMATION — identity, contacts, capability, registration + onboarding detail
// ---------------------------------------------------------------------------
function InformationTab({ vendor, isProcurement, isInternal, onInvite, onChange, user }: {
  vendor: VendorDetailDTO; isProcurement: boolean; isInternal: boolean; onInvite: () => void; onChange: (v: VendorDetailDTO) => void; user: ReturnType<typeof useAuth>["user"];
}) {
  const s = vendor.submission;
  const inv = vendor.invitation;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Company information</h2>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <Row label="Legal name" value={vendor.legalName} />
              <Row label="Trade name" value={s?.tradeName} />
              <Row label="Vendor ID" value={vendor.id} />
              <Row label="SAP vendor ID" value={vendor.sapVendorId} />
              <Row label="Tier" value={vendor.tier ? supplierTierLabels[vendor.tier] : null} />
            </div>
            <div>
              <Row label="Industry" value={vendor.category} />
              <Row label="Business type" value={s?.businessType} />
              <Row label="Ownership" value={s?.ownershipStructure} />
              <Row label="Website" value={s?.website} />
              <Row label="Address" value={[s?.addressLine1, s?.city, s?.state, s?.postalCode].filter(Boolean).join(", ") || null} />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Registration &amp; tax</h2>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <Row label="PAN" value={s?.pan} />
              <Row label="GSTIN" value={s?.gstin} />
              <Row label="Udyam / MSME" value={s?.udyam} />
            </div>
            <div>
              <Row label="Bank" value={s?.bankName} />
              <Row label="Account" value={s?.bankAccountNumber} />
              <Row label="IFSC" value={s?.bankIfsc} />
            </div>
          </div>
        </Card>

        {s && (s.products || s.qualityCertifications || s.manufacturingCapability) && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Business &amp; capability</h2>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <div>
                <Row label="Products" value={s.products} />
                <Row label="Components" value={s.components} />
                <Row label="Capability" value={s.manufacturingCapability} />
              </div>
              <div>
                <Row label="Annual capacity" value={s.annualCapacity} />
                <Row label="Lead time" value={s.leadTimeDays != null ? `${s.leadTimeDays} days` : null} />
                <Row label="Quality certs" value={s.qualityCertifications} />
              </div>
            </div>
          </Card>
        )}

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Contacts</h2>
          <ContactsPanel vendor={vendor} canEdit={isProcurement} onChange={onChange} />
        </Card>
      </div>

      {/* Right rail: onboarding + verification + ERP + SLA */}
      <div className="space-y-5 lg:col-span-1">
        {isProcurement && (
          <Card>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Onboarding invitation</h2>
            {inv && !inv.expired && inv.status !== "REVOKED" ? (
              <>
                <p className="text-sm text-slate-600">{inv.status === "OPENED" ? "Opened by vendor" : "Invitation sent"} · <span className="font-medium">{inv.email}</span></p>
                <p className="text-xs text-slate-400">Expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/vendors/${vendor.id}/portal`}><Button variant="secondary">View onboarding</Button></Link>
                  <Button variant="secondary" onClick={onInvite}>Resend invitation</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">{inv?.expired ? "The previous invitation expired." : "Invite this vendor to complete self-serve onboarding."}</p>
                <div className="mt-3"><Button onClick={onInvite}>Send onboarding invite</Button></div>
              </>
            )}
          </Card>
        )}
        <OnboardingProgress progress={vendor.progress} />
        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Verification status</h2>
          {vendor.checks.length === 0 ? <p className="text-sm text-slate-400">Verification has not been run yet.</p> : <VerificationSummary items={vendor.verificationSummary} />}
        </Card>
        {isInternal && vendor.status !== "VERIFIED" && <SlaReminderPanel vendor={vendor} canRemind={isProcurement} />}
        {isInternal && <ErpHandoffCard vendor={vendor} canRetry={isProcurement} onChange={onChange} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FINANCE
// ---------------------------------------------------------------------------
type FinSub = "overview" | "invoices" | "reconciliation" | "ledger";
function FinanceTab({ vendor, invoices, contracts, setTab }: { vendor: VendorDetailDTO; invoices: InvoiceDTO[] | null; contracts: ContractDTO[] | null; setTab: (t: TabKey) => void }) {
  const [params, setParams] = useSearchParams();
  const [recon, setRecon] = useState<ReconciliationRowDTO[] | null>(null);
  const [ledger, setLedger] = useState<VendorLedgerDTO | null>(null);

  useEffect(() => {
    getVendorLedger(vendor.id).then(setLedger).catch(() => {});
    getVendorReconciliation(vendor.id).then(setRecon).catch(() => setRecon([]));
  }, [vendor.id]);

  const fin = (params.get("fin") as FinSub) || "overview";
  const setFin = (f: FinSub, invId?: string) => {
    params.set("tab", "finance");
    params.set("fin", f);
    if (invId) params.set("inv", invId); else params.delete("inv");
    setParams(params);
  };

  if (invoices == null) return <p className="text-slate-400">Loading finance…</p>;
  const subtabs: { key: FinSub; label: string }[] = [
    { key: "overview", label: "Overview" }, { key: "invoices", label: "Invoices" },
    { key: "reconciliation", label: "Reconciliation" }, { key: "ledger", label: "Ledger" },
  ];

  return (
    <div className="space-y-5">
      {/* Finance sub-navigation (persistent) */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {subtabs.map((t) => (
          <button key={t.key} onClick={() => setFin(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${fin === t.key ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {fin === "overview" && <FinanceOverviewSub vendor={vendor} invoices={invoices} contracts={contracts} ledger={ledger} setFin={setFin} setTab={setTab} />}
      {fin === "invoices" && <InvoicesSub vendor={vendor} invoices={invoices} openId={params.get("inv")} />}
      {fin === "reconciliation" && <ReconciliationSub vendor={vendor} recon={recon} setFin={setFin} />}
      {fin === "ledger" && <LedgerSub vendor={vendor} ledger={ledger} />}
    </div>
  );
}

function financeTotals(invoices: InvoiceDTO[]) {
  return {
    total: invoices.reduce((a, i) => a + i.totalAmount, 0),
    paid: invoices.reduce((a, i) => a + i.amountPaid, 0),
    outstanding: invoices.reduce((a, i) => a + i.outstanding, 0),
    gst: invoices.reduce((a, i) => a + i.taxAmount, 0),
    tds: invoices.reduce((a, i) => a + (i.tdsAmount ?? 0), 0),
    matched: invoices.filter((i) => i.status === "MATCHED").length,
    exceptions: invoices.filter((i) => i.status === "EXCEPTION" || i.overdue).length,
  };
}

function FinanceOverviewSub({ vendor, invoices, contracts, ledger, setFin, setTab }: {
  vendor: VendorDetailDTO; invoices: InvoiceDTO[]; contracts: ContractDTO[] | null; ledger: VendorLedgerDTO | null; setFin: (f: FinSub) => void; setTab: (t: TabKey) => void;
}) {
  const t = financeTotals(invoices);
  const activeContract = (contracts ?? []).find((c) => c.status === "ACTIVE");
  const lastPaid = ledger?.payments.length ? ledger.payments[ledger.payments.length - 1] : null;
  const exceptionValue = invoices.filter((i) => i.status === "EXCEPTION" || i.overdue).reduce((a, i) => a + i.totalAmount, 0);
  const overdue = invoices.filter((i) => i.overdue).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <FinStat label="Invoices" value={String(invoices.length)} onClick={() => setFin("invoices")} />
        <FinStat label="Matched" value={String(t.matched)} tone="green" onClick={() => setFin("invoices")} />
        <FinStat label="Exceptions" value={String(t.exceptions)} tone={t.exceptions ? "red" : "neutral"} onClick={() => setFin("reconciliation")} />
        <FinStat label="Total invoiced" value={money0(t.total)} onClick={() => setFin("invoices")} />
        <FinStat label="Total paid" value={money0(t.paid)} tone="green" onClick={() => setFin("ledger")} />
        <FinStat label="Outstanding" value={money0(t.outstanding)} tone={t.outstanding > 0 ? "red" : "neutral"} onClick={() => setFin("ledger")} />
        <FinStat label="Exception value" value={money0(exceptionValue)} tone={exceptionValue ? "red" : "neutral"} onClick={() => setFin("reconciliation")} />
        <FinStat label="Overdue invoices" value={String(overdue)} tone={overdue ? "amber" : "neutral"} onClick={() => setFin("invoices")} />
        <FinStat label="Contract value" value={activeContract?.value != null ? money0(activeContract.value) : "—"} onClick={() => setTab("contracts")} />
        <FinStat label="Renewal in" value={activeContract ? (activeContract.expired ? "Overdue" : `${activeContract.daysToExpiry}d`) : "—"} tone={activeContract?.renewalDue || activeContract?.expired ? "amber" : "neutral"} onClick={() => setTab("contracts")} />
        <FinStat label="Last payment" value={lastPaid ? new Date(lastPaid.paymentDate).toLocaleDateString() : "—"} tone="green" onClick={() => setFin("ledger")} />
        <FinStat label="GST · TDS" value={`${money0(t.gst)} · ${money0(t.tds)}`} />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Go to</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setFin("invoices")}>View Invoices →</Button>
          <Button variant="secondary" onClick={() => setFin("reconciliation")}>View Reconciliation →</Button>
          <Button variant="secondary" onClick={() => setFin("ledger")}>View Ledger →</Button>
          <Button variant="secondary" onClick={() => setTab("contracts")}>View Contracts →</Button>
        </div>
      </Card>
    </div>
  );
}

function InvoicesSub({ vendor, invoices, openId }: { vendor: VendorDetailDTO; invoices: InvoiceDTO[]; openId: string | null }) {
  const [open, setOpen] = useState<string | null>(openId);
  const t = financeTotals(invoices);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <FinStat label="Invoices" value={String(invoices.length)} />
        <FinStat label="Matched" value={String(t.matched)} tone="green" />
        <FinStat label="Exceptions" value={String(t.exceptions)} tone={t.exceptions ? "red" : "neutral"} />
        <FinStat label="Paid" value={money0(t.paid)} tone="green" />
        <FinStat label="Outstanding" value={money0(t.outstanding)} tone={t.outstanding > 0 ? "red" : "neutral"} />
      </div>
      <Card className="p-0">
        <div className="border-b border-slate-100 p-4 text-sm font-semibold text-slate-700">Invoice register — {vendor.legalName}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2">Invoice #</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">PO #</th><th className="px-4 py-2">Total</th><th className="px-4 py-2">Outstanding</th><th className="px-4 py-2">Match</th><th className="px-4 py-2">Payment</th><th className="px-4 py-2">Due</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">No invoices for this vendor.</td></tr>}
              {invoices.map((inv) => (
                <Fragment key={inv.id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === inv.id ? null : inv.id)}>
                    <td className="px-4 py-2 font-medium text-indigo-700">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2 text-slate-500">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-slate-500">{inv.poNumber ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{money0(inv.totalAmount)}</td>
                    <td className="px-4 py-2">{money0(inv.outstanding)} {inv.overdue && <Badge tone="danger">Overdue</Badge>}</td>
                    <td className="px-4 py-2">{inv.matchStatus ? <Badge tone={inv.matchStatus === "MATCHED" ? "success" : "danger"}>{inv.matchStatus === "MATCHED" ? "3-way" : "!"}</Badge> : "—"}</td>
                    <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-2 text-slate-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2 text-right text-xs text-indigo-600">{open === inv.id ? "Hide ▲" : "Detail ▼"}</td>
                  </tr>
                  {open === inv.id && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
                          <Row label="Invoice date" value={new Date(inv.invoiceDate).toLocaleDateString()} />
                          <Row label="Due date" value={inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : null} />
                          <Row label="PO / GRN" value={[inv.poNumber, inv.grnNumber].filter(Boolean).join(" · ") || null} />
                          <Row label="Subtotal" value={money0(inv.subtotal)} />
                          <Row label={`GST${inv.gstRate ? ` @ ${inv.gstRate}%` : ""}`} value={money0(inv.taxAmount)} />
                          <Row label={`TDS${inv.tdsRate ? ` @ ${inv.tdsRate}%` : ""}`} value={inv.tdsAmount != null ? money0(inv.tdsAmount) : "—"} />
                          <Row label="Total" value={money0(inv.totalAmount)} />
                          <Row label="Net payable" value={money0(inv.netPayable)} />
                          <Row label="Paid / Outstanding" value={`${money0(inv.amountPaid)} / ${money0(inv.outstanding)}`} />
                          <Row label="Match" value={inv.matchStatus} />
                          <Row label="MSME" value={inv.isMsme ? "Yes (45-day term)" : "No"} />
                          <Row label="Bill To / Ship To" value="Vendrax Motors Ltd · Pune plant" />
                        </div>
                        {inv.note && <p className="mt-2 text-xs text-rose-600">{inv.note}</p>}
                        <div className="mt-3"><Button variant="secondary" onClick={() => void downloadInvoicePdf(inv.id, inv.invoiceNumber)}>⬇ Download invoice PDF</Button></div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ReconciliationSub({ vendor, recon, setFin }: { vendor: VendorDetailDTO; recon: ReconciliationRowDTO[] | null; setFin: (f: FinSub, invId?: string) => void }) {
  const safeName = vendor.legalName.replace(/\s+/g, "-");
  const open = (recon ?? []).filter((r) => r.resolutionStatus === "OPEN").length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FinStat label="Lines" value={String(recon?.length ?? 0)} />
        <FinStat label="Open exceptions" value={String(open)} tone={open ? "red" : "neutral"} />
        <FinStat label="Matched" value={String((recon ?? []).filter((r) => r.matchStatus === "MATCHED").length)} tone="green" />
        <FinStat label="Variance value" value={money0((recon ?? []).reduce((a, r) => a + Math.abs(r.variance), 0))} tone="amber" />
      </div>
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <span className="text-sm font-semibold text-slate-700">Reconciliation — invoice vs PO</span>
          <Button variant="secondary" onClick={() => void downloadReconciliationXlsx(vendor.id, safeName)}>⬇ Reconciliation (XLSX)</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2">Invoice #</th><th className="px-4 py-2">PO #</th><th className="px-4 py-2">Invoice amt</th><th className="px-4 py-2">PO amt</th><th className="px-4 py-2">Difference</th><th className="px-4 py-2">Match</th><th className="px-4 py-2">Exception</th><th className="px-4 py-2">Resolution</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recon == null ? <tr><td colSpan={8} className="px-4 py-4 text-center text-slate-400">Loading…</td></tr>
              : recon.map((r) => (
                <tr key={r.invoiceId} className={`cursor-pointer hover:bg-slate-50 ${r.resolutionStatus === "OPEN" ? "bg-rose-50/40" : ""}`} onClick={() => setFin("invoices", r.invoiceId)} title="Open invoice">
                  <td className="px-4 py-2 font-medium text-indigo-700">{r.invoiceNumber}</td>
                  <td className="px-4 py-2 text-slate-500">{r.poNumber ?? "—"}</td>
                  <td className="px-4 py-2">{money0(r.invoiceAmount)}</td>
                  <td className="px-4 py-2">{r.poAmount != null ? money0(r.poAmount) : "—"}</td>
                  <td className={`px-4 py-2 ${r.variance ? "font-medium text-rose-600" : "text-slate-500"}`}>{r.poAmount != null ? money0(r.invoiceAmount - r.poAmount) : "—"}</td>
                  <td className="px-4 py-2"><Badge tone={r.matchStatus === "MATCHED" ? "success" : "danger"}>{r.matchStatus ?? "—"}</Badge></td>
                  <td className="px-4 py-2 text-xs text-slate-600">{r.exceptionType ?? "—"}</td>
                  <td className="px-4 py-2"><Badge tone={r.resolutionStatus === "OPEN" ? "danger" : r.resolutionStatus === "RESOLVED" ? "success" : "neutral"}>{r.resolutionStatus}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function LedgerSub({ vendor, ledger }: { vendor: VendorDetailDTO; ledger: VendorLedgerDTO | null }) {
  const safeName = vendor.legalName.replace(/\s+/g, "-");
  if (ledger == null) return <p className="text-slate-400">Loading ledger…</p>;
  if (ledger.entries.length === 0) return <Card><p className="text-sm text-slate-400">No ledger transactions for this vendor yet.</p></Card>;
  const firstDate = ledger.entries[0]?.date;
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Vendor Account Statement</h2>
          <p className="text-xs text-slate-500">{vendor.legalName} {ledger.isMsme && <Badge tone="info">MSME · 45-day term</Badge>}</p>
        </div>
        <Button variant="secondary" onClick={() => void downloadLedgerXlsx(vendor.id, safeName)}>⬇ Download Ledger (XLSX)</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="border-b-2 border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Particulars / Reference</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
              <th className="px-4 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-slate-50/60 italic text-slate-500">
              <td className="px-4 py-1.5">{firstDate ? new Date(firstDate).toLocaleDateString() : "—"}</td>
              <td className="px-4 py-1.5">Opening balance</td>
              <td className="px-4 py-1.5 text-right">—</td>
              <td className="px-4 py-1.5 text-right">—</td>
              <td className="px-4 py-1.5 text-right font-medium">{money0(0)}</td>
            </tr>
            {ledger.entries.map((e, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-1.5 text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                <td className="px-4 py-1.5">
                  <span className="font-medium text-slate-800">{e.reference}</span>
                  <span className="ml-2 text-xs text-slate-400">{e.type === "INVOICE" ? "Purchase invoice" : "Payment / UTR"}</span>
                </td>
                <td className="px-4 py-1.5 text-right text-slate-800">{e.debit ? money0(e.debit) : "—"}</td>
                <td className="px-4 py-1.5 text-right text-emerald-700">{e.credit ? money0(e.credit) : "—"}</td>
                <td className="px-4 py-1.5 text-right font-semibold text-slate-900">{money0(e.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
            <tr>
              <td className="px-4 py-2" colSpan={2}>Totals · Closing balance</td>
              <td className="px-4 py-2 text-right">{money0(ledger.totalInvoiced)}</td>
              <td className="px-4 py-2 text-right text-emerald-700">{money0(ledger.totalPaid)}</td>
              <td className="px-4 py-2 text-right text-rose-700">{money0(ledger.outstanding)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// APPROVALS (icon + text status)
// ---------------------------------------------------------------------------
const APPROVAL_ICON: Record<ApprovalStatus, { glyph: string; tone: Parameters<typeof Badge>[0]["tone"] }> = {
  APPROVED: { glyph: "✓", tone: "success" },
  PENDING: { glyph: "◷", tone: "progress" },
  REJECTED: { glyph: "✕", tone: "danger" },
  CHANGES_REQUESTED: { glyph: "↺", tone: "info" },
};
function ApprovalsTab({ vendor, user, onChange }: { vendor: VendorDetailDTO; user: ReturnType<typeof useAuth>["user"]; onChange: (v: VendorDetailDTO) => void }) {
  return (
    <div className="space-y-5">
      {user && <ApproverActionPanel vendor={vendor} role={user.role} onChange={onChange} />}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Internal approvals</h2>
        {vendor.approvals.length === 0 ? (
          <p className="text-sm text-slate-400">Approval tasks are created after verification passes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {vendor.approvals.map((a) => {
              const ic = APPROVAL_ICON[a.status];
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500" aria-hidden>{ic.glyph}</span>
                    <div>
                      <span className="font-medium text-slate-800">{a.function}</span>
                      {a.decidedByName && <span className="ml-2 text-xs text-slate-400">{a.decidedByName}{a.decidedAt ? ` · ${new Date(a.decidedAt).toLocaleDateString()}` : ""}</span>}
                      {a.notes && <p className="text-xs text-slate-500">{a.notes}</p>}
                    </div>
                  </div>
                  <Badge tone={ic.tone}>{a.status.replace(/_/g, " ")}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACTIVITY
// ---------------------------------------------------------------------------
const ACTIVITY_ICON = (label: string): string => {
  const l = label.toLowerCase();
  if (l.includes("payment")) return "💰";
  if (l.includes("invoice")) return "🧾";
  if (l.includes("document")) return "📄";
  if (l.includes("verification")) return "🛡";
  if (l.includes("approval")) return "✅";
  if (l.includes("contract")) return "📃";
  if (l.includes("performance")) return "📊";
  if (l.includes("invitation")) return "✉";
  if (l.includes("sap") || l.includes("handoff")) return "🔗";
  return "•";
};
function ActivityList({ items }: { items: VendorDetailDTO["activity"] }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">No activity yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs" aria-hidden>{ACTIVITY_ICON(a.label)}</span>
          <div>
            <p className="font-medium text-slate-800">{a.label}</p>
            <p className="text-xs text-slate-400">{a.actorName ? `${a.actorName} · ` : ""}{new Date(a.at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
