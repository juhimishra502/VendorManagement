import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onboardingStatuses, supplierTierLabels, type VendorSummaryDTO } from "@vendor-management/shared";
import { Badge, Card, StatusBadge, humanStatus } from "./ui.js";

function verificationState(v: VendorSummaryDTO): "Not run" | "Passed" | "Failed" | "Partial" {
  if (v.totalChecks === 0) return "Not run";
  if (v.onboardingStatus === "VERIFICATION_FAILED") return "Failed";
  if (v.completedChecks === v.totalChecks) return "Passed";
  return "Partial";
}
function approvalState(v: VendorSummaryDTO): "Not started" | "In progress" | "Approved" {
  if (v.totalApprovals === 0) return "Not started";
  if (v.completedApprovals === v.totalApprovals) return "Approved";
  return "In progress";
}
function docState(v: VendorSummaryDTO): "None" | "Partial" | "Complete" {
  if (v.requiredDocsUploaded === 0) return "None";
  if (v.requiredDocsUploaded >= v.requiredDocsTotal) return "Complete";
  return "Partial";
}
const slaDot: Record<string, string> = {
  ON_TRACK: "bg-emerald-500",
  AT_RISK: "bg-amber-500",
  BREACHED: "bg-rose-500",
  DONE: "bg-slate-300",
};

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="w-full text-xs text-slate-500 sm:w-auto">
      <span className="mb-1 block font-medium uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-800 sm:w-auto sm:py-1.5"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VendorTable({ vendors }: { vendors: VendorSummaryDTO[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [owner, setOwner] = useState("ALL");
  const [verification, setVerification] = useState("ALL");
  const [approval, setApproval] = useState("ALL");
  const [docs, setDocs] = useState("ALL");

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendors) if (v.responsibleFunction) for (const f of v.responsibleFunction.split(", ")) set.add(f);
    return [...set].sort();
  }, [vendors]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (q && !v.legalName.toLowerCase().includes(q) && !v.id.toLowerCase().includes(q)) return false;
      if (status !== "ALL" && v.onboardingStatus !== status) return false;
      if (owner !== "ALL" && !(v.responsibleFunction ?? "").includes(owner)) return false;
      if (verification !== "ALL" && verificationState(v) !== verification) return false;
      if (approval !== "ALL" && approvalState(v) !== approval) return false;
      if (docs !== "ALL" && docState(v) !== docs) return false;
      return true;
    });
  }, [vendors, search, status, owner, verification, approval, docs]);

  return (
    <Card className="p-0">
      <div className="flex flex-col items-stretch gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="w-full text-xs text-slate-500 sm:w-auto">
          <span className="mb-1 block font-medium uppercase tracking-wide">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vendor name or id"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-56 sm:py-1.5"
          />
        </label>
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: "ALL", label: "All" }, ...onboardingStatuses.map((s) => ({ value: s, label: humanStatus(s) }))]}
        />
        <Select
          label="Owner"
          value={owner}
          onChange={setOwner}
          options={[{ value: "ALL", label: "All" }, ...owners.map((o) => ({ value: o, label: o }))]}
        />
        <Select
          label="Verification"
          value={verification}
          onChange={setVerification}
          options={["ALL", "Not run", "Partial", "Passed", "Failed"].map((s) => ({ value: s, label: s }))}
        />
        <Select
          label="Approval"
          value={approval}
          onChange={setApproval}
          options={["ALL", "Not started", "In progress", "Approved"].map((s) => ({ value: s, label: s }))}
        />
        <Select
          label="Documents"
          value={docs}
          onChange={setDocs}
          options={["ALL", "None", "Partial", "Complete"].map((s) => ({ value: s, label: s }))}
        />
        <span className="ml-auto self-center text-xs text-slate-400">
          {rows.length} of {vendors.length}
        </span>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Docs</th>
              <th className="px-4 py-3">Approvals</th>
              <th className="px-4 py-3">Current action</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={12}>
                  No vendors match these filters.
                </td>
              </tr>
            ) : (
              rows.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/vendors/${v.id}`} className="font-medium text-indigo-600 hover:underline">
                      {v.legalName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {v.tier ? <Badge tone="neutral">{supplierTierLabels[v.tier]}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.onboardingStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${v.progressPercent}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{v.progressPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.totalChecks ? `${v.completedChecks}/${v.totalChecks}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.requiredDocsUploaded}/{v.requiredDocsTotal}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.totalApprovals ? `${v.completedApprovals}/${v.totalApprovals}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.pendingActions}</td>
                  <td className="px-4 py-3">
                    {v.responsibleFunction ? <Badge tone="neutral">{v.responsibleFunction}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-slate-600" title={v.slaStatus}>
                      <span className={`h-2 w-2 rounded-full ${slaDot[v.slaStatus] ?? "bg-slate-300"}`} />
                      {v.onboardingAgeDays}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(v.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: each vendor row becomes a card */}
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No vendors match these filters.</p>
        ) : (
          rows.map((v) => (
            <div key={v.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/vendors/${v.id}`} className="font-semibold text-indigo-600">
                  {v.legalName}
                </Link>
                <StatusBadge status={v.onboardingStatus} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {v.tier ? <Badge tone="neutral">{supplierTierLabels[v.tier]}</Badge> : null}
                {v.category ? <span>{v.category}</span> : null}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Progress</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{v.progressPercent}%</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Verification</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {v.totalChecks ? `${v.completedChecks}/${v.totalChecks}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Docs</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {v.requiredDocsUploaded}/{v.requiredDocsTotal}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">SLA</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-800">
                    <span className={`h-2 w-2 rounded-full ${slaDot[v.slaStatus] ?? "bg-slate-300"}`} />
                    {v.onboardingAgeDays}d
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Current action</dt>
                  <dd className="mt-0.5 text-slate-700">{v.pendingActions}</dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Updated {new Date(v.updatedAt).toLocaleDateString()}</span>
                <Link to={`/vendors/${v.id}`} className="font-semibold text-indigo-600">
                  View vendor →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
