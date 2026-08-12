import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createRequestSchema,
  erpStatusLabels,
  requestPriorities,
  supplierTiers,
  supplierTierLabels,
  type BusinessRequestDTO,
  type ErpStatus,
  type RequestPriority,
} from "@vendor-management/shared";
import { createRequest, convertRequest, listRequests, updateRequest } from "../lib/requests.js";
import { useAuth } from "../lib/auth.js";
import { Badge, Button, Card, ErrorText, Field, StatusBadge, TextInput } from "../components/ui.js";

function isManager(role?: string): boolean {
  return role === "ADMIN" || role === "PROCUREMENT";
}

function erpStatusLabel(status: string): string {
  return erpStatusLabels[status as ErpStatus] ?? status;
}

// ---------------------------------------------------------------------------
// New request form (Business / Procurement)
// ---------------------------------------------------------------------------

export function NewRequestPage() {
  const navigate = useNavigate();
  const [vendorName, setVendorName] = useState("");
  const [category, setCategory] = useState("");
  const [vendorType, setVendorType] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("MEDIUM");
  const [businessJustification, setJustification] = useState("");
  const [businessRequirement, setRequirement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = createRequestSchema.safeParse({
      vendorName,
      category: category || undefined,
      vendorType: vendorType || undefined,
      priority,
      businessJustification,
      businessRequirement: businessRequirement || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    try {
      await createRequest(parsed.data);
      navigate("/requests");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not raise request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/requests" className="text-sm text-indigo-600 hover:underline">
        ← My requests
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Raise a vendor request</h1>
      <p className="text-sm text-slate-500">Procurement will review, shortlist and start onboarding. You can track progress here.</p>
      <Card>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Vendor name">
            <TextInput value={vendorName} onChange={(e) => setVendorName(e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Automotive category">
              <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Brake Systems" />
            </Field>
            <Field label="Vendor type">
              <TextInput value={vendorType} onChange={(e) => setVendorType(e.target.value)} placeholder="e.g. Production part" />
            </Field>
          </div>
          <Field label="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as RequestPriority)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {requestPriorities.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Business justification">
            <textarea
              value={businessJustification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </Field>
          <Field label="Business requirement (optional)">
            <textarea
              value={businessRequirement}
              onChange={(e) => setRequirement(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Convert-to-vendor modal (Procurement)
// ---------------------------------------------------------------------------

function ConvertModal({ req, onClose, onDone }: { req: BusinessRequestDTO; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    setBusy(true);
    try {
      await convertRequest(req.id, { contactEmail: email || undefined, tier: tier || undefined });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create vendor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">Create vendor from request</h2>
        <p className="mt-1 text-sm text-slate-500">{req.vendorName}</p>
        <div className="mt-4 space-y-3">
          <Field label="Vendor contact email (for the invitation)">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ap@vendor.example" />
          </Field>
          <Field label="Supplier tier (optional)">
            <select value={tier} onChange={(e) => setTier(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">—</option>
              {supplierTiers.map((t) => (
                <option key={t} value={t}>
                  {supplierTierLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={go}>
            {busy ? "Creating…" : "Create vendor"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Requests list (Business = own read-only; Procurement = all + actions)
// ---------------------------------------------------------------------------

export function RequestsPage() {
  const { user } = useAuth();
  const manager = isManager(user?.role);
  const [rows, setRows] = useState<BusinessRequestDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [convert, setConvert] = useState<BusinessRequestDTO | null>(null);

  function load() {
    setLoading(true);
    listRequests()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load requests"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function setStatus(r: BusinessRequestDTO, status: "IN_REVIEW" | "SHORTLISTED" | "BLOCKED") {
    setError(null);
    try {
      if (status === "BLOCKED") {
        const reason = window.prompt("Reason for blocking this request?") ?? "";
        await updateRequest(r.id, "BLOCKED", reason);
      } else {
        await updateRequest(r.id, status);
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update request");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{manager ? "Vendor requests" : "My vendor requests"}</h1>
          <p className="text-sm text-slate-500">
            {manager ? "Incoming business requests to review, shortlist and onboard." : "Track your requests without chasing Procurement."}
          </p>
        </div>
        {!manager && (
          <Link to="/requests/new">
            <Button>+ New request</Button>
          </Link>
        )}
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Onboarding</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Blocker</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">ERP</th>
                {manager && <th className="px-4 py-3">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={manager ? 9 : 8}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={manager ? 9 : 8}>
                    {manager ? "No requests yet." : "You haven’t raised any requests yet."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.vendorName}</div>
                      <div className="text-xs text-slate-400">{r.category ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={r.priority === "URGENT" || r.priority === "HIGH" ? "danger" : "neutral"}>{r.priority}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.status === "BLOCKED" && r.blockedReason ? (
                        <div className="text-xs text-rose-600">{r.blockedReason}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{r.onboardingStatus ? <StatusBadge status={r.onboardingStatus} /> : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.progressPercent != null ? `${r.progressPercent}%` : "—"}</td>
                    <td className="px-4 py-3">
                      {r.currentBlocker ? <span className="text-rose-600">{r.currentBlocker}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.currentOwner ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.sapVendorId ?? (r.erpStatus ? erpStatusLabel(r.erpStatus) : "—")}
                    </td>
                    {manager && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {r.vendorId ? (
                            <Link to={`/vendors/${r.vendorId}`} className="text-xs font-medium text-indigo-600 hover:underline">
                              Open vendor →
                            </Link>
                          ) : (
                            <>
                              {r.status === "REQUESTED" && (
                                <Button variant="ghost" onClick={() => setStatus(r, "IN_REVIEW")}>
                                  Review
                                </Button>
                              )}
                              {(r.status === "REQUESTED" || r.status === "IN_REVIEW") && (
                                <Button variant="ghost" onClick={() => setStatus(r, "SHORTLISTED")}>
                                  Shortlist
                                </Button>
                              )}
                              {r.status === "SHORTLISTED" && (
                                <Button onClick={() => setConvert(r)}>Create vendor</Button>
                              )}
                              {r.status !== "BLOCKED" && (
                                <Button variant="ghost" onClick={() => setStatus(r, "BLOCKED")}>
                                  Block
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {convert && <ConvertModal req={convert} onClose={() => setConvert(null)} onDone={() => { setConvert(null); load(); }} />}
    </div>
  );
}
