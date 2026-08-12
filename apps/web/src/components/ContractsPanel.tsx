import { useEffect, useState } from "react";
import {
  contractStatusLabels,
  defaultContractTerms,
  obligationStatusLabels,
  obligationStatuses,
  type ContractDisplayStatus,
  type ContractDTO,
} from "@vendor-management/shared";
import {
  addObligation,
  createContract,
  listVendorContracts,
  setContractStatus,
  updateObligation,
} from "../lib/contracts.js";
import { money } from "../routes/finance.js";
import { Badge, Button, Card, ErrorText } from "./ui.js";

const displayTone: Record<ContractDisplayStatus, Parameters<typeof Badge>[0]["tone"]> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  EXPIRING: "progress",
  EXPIRED: "danger",
  TERMINATED: "danger",
  RENEWED: "info",
};
const displayLabel: Record<ContractDisplayStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  EXPIRING: "Expiring soon",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
  RENEWED: "Renewed",
};

function NewContractForm({ vendorId, onDone, onCancel }: { vendorId: string; onDone: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "",
    contractType: "Supply agreement",
    startDate: today,
    endDate: nextYear,
    value: "",
    renewalNoticeDays: "30",
    autoRenew: false,
    terms: defaultContractTerms,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = "w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm";

  async function submit() {
    setError(null);
    if (form.title.trim().length < 2) return setError("Enter a contract title.");
    setBusy(true);
    try {
      await createContract(vendorId, {
        title: form.title.trim(),
        contractType: form.contractType.trim() || undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        value: form.value.trim() === "" ? undefined : Number(form.value),
        currency: "INR",
        autoRenew: form.autoRenew,
        renewalNoticeDays: Number(form.renewalNoticeDays || 30),
        terms: form.terms,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create contract");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={input} />
        <input placeholder="Type" value={form.contractType} onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))} className={input} />
        <label className="text-xs text-slate-500">Start<input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={input} /></label>
        <label className="text-xs text-slate-500">End<input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={input} /></label>
        <input type="number" placeholder="Value (INR)" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className={input} />
        <label className="text-xs text-slate-500">Renewal notice (days)<input type="number" value={form.renewalNoticeDays} onChange={(e) => setForm((f) => ({ ...f, renewalNoticeDays: e.target.value }))} className={input} /></label>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm((f) => ({ ...f, autoRenew: e.target.checked }))} />
        Auto-renew
      </label>
      <label className="block text-xs text-slate-500">
        Terms &amp; conditions
        <textarea value={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))} rows={5} className={input} />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : "Create contract"}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function ContractCard({ contract, canManage, onChange }: { contract: ContractDTO; canManage: boolean; onChange: () => void }) {
  const [showTerms, setShowTerms] = useState(false);
  const [obl, setObl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-800">{contract.title}</div>
          <div className="text-xs text-slate-500">
            {contract.contractType ?? "Contract"} · {new Date(contract.startDate).toLocaleDateString()} –{" "}
            {new Date(contract.endDate).toLocaleDateString()}
            {contract.value != null ? ` · ${money(contract.value, contract.currency)}` : ""}
          </div>
        </div>
        <Badge tone={displayTone[contract.displayStatus]}>{displayLabel[contract.displayStatus]}</Badge>
      </div>

      {(contract.renewalDue || contract.expired) && (
        <p className="mt-2 text-xs text-amber-700">
          {contract.expired ? "Contract has expired." : `Renewal due in ${contract.daysToExpiry} day(s).`}
        </p>
      )}

      {contract.obligations.length > 0 && (
        <ul className="mt-2 space-y-1">
          {contract.obligations.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 text-xs">
              <span className={o.overdue ? "text-rose-600" : "text-slate-600"}>
                {o.description}
                {o.dueDate ? ` · due ${new Date(o.dueDate).toLocaleDateString()}` : ""}
              </span>
              {canManage ? (
                <select
                  value={o.status}
                  onChange={(e) => void run(() => updateObligation(o.id, e.target.value as never))}
                  className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                >
                  {obligationStatuses.map((s) => (
                    <option key={s} value={s}>{obligationStatusLabels[s]}</option>
                  ))}
                </select>
              ) : (
                <Badge tone={o.status === "BREACHED" ? "danger" : o.status === "MET" ? "success" : "neutral"}>
                  {obligationStatusLabels[o.status]}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="text-xs text-indigo-600 hover:underline" onClick={() => setShowTerms((v) => !v)}>
          {showTerms ? "Hide T&C" : "View T&C"}
        </button>
        {canManage && contract.status === "DRAFT" && (
          <Button variant="secondary" onClick={() => void run(() => setContractStatus(contract.id, "ACTIVE"))}>Activate</Button>
        )}
        {canManage && contract.status === "ACTIVE" && (
          <>
            <Button variant="secondary" onClick={() => void run(() => setContractStatus(contract.id, "RENEWED"))}>Mark renewed</Button>
            <Button variant="secondary" onClick={() => void run(() => setContractStatus(contract.id, "TERMINATED"))}>Terminate</Button>
          </>
        )}
      </div>

      {canManage && (
        <div className="mt-2 flex gap-2">
          <input
            placeholder="Add obligation…"
            value={obl}
            onChange={(e) => setObl(e.target.value)}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <Button
            variant="secondary"
            onClick={() => obl.trim() && void run(async () => { await addObligation(contract.id, { description: obl.trim() }); setObl(""); })}
          >
            Add
          </Button>
        </div>
      )}

      {showTerms && <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">{contract.terms ?? "No terms recorded."}</pre>}
      {error && <div className="mt-1"><ErrorText>{error}</ErrorText></div>}
    </div>
  );
}

// Contracts + obligations + T&C for a vendor (internal).
export function ContractsPanel({ vendorId, canManage }: { vendorId: string; canManage: boolean }) {
  const [contracts, setContracts] = useState<ContractDTO[] | null>(null);
  const [showNew, setShowNew] = useState(false);

  function load() {
    listVendorContracts(vendorId).then(setContracts).catch(() => setContracts([]));
  }
  useEffect(load, [vendorId]);

  if (!contracts) return null;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contracts</h2>
        {canManage && !showNew && <Button variant="secondary" onClick={() => setShowNew(true)}>New contract</Button>}
      </div>
      {contracts.length === 0 && !showNew && <p className="text-sm text-slate-500">No contracts recorded.</p>}
      <div className="space-y-3">
        {contracts.map((c) => (
          <ContractCard key={c.id} contract={c} canManage={canManage} onChange={load} />
        ))}
      </div>
      {showNew && <NewContractForm vendorId={vendorId} onCancel={() => setShowNew(false)} onDone={() => { setShowNew(false); load(); }} />}
    </Card>
  );
}
