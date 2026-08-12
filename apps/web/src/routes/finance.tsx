import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  financeExceptionLabels,
  invoiceStatusLabels,
  matchStatusLabels,
  type FinanceControlDTO,
  type InvoiceDTO,
  type InvoiceSummaryDTO,
  type VendorSummaryDTO,
} from "@vendor-management/shared";
import { listAllInvoices, getInvoiceSummary, createInvoice, setInvoiceStatus, recordPayment, getFinanceControl, downloadInvoicePdf } from "../lib/finance.js";
import { listVendors } from "../lib/vendors.js";
import { useAuth } from "../lib/auth.js";
import { Badge, Button, Card, ErrorText, StatusBadge } from "../components/ui.js";

export function money(n: number, currency = "INR"): string {
  return `${currency === "INR" ? "₹" : ""}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function isFinance(role?: string): boolean {
  return role === "ADMIN" || role === "FINANCE";
}

function SummaryCards({ s }: { s: InvoiceSummaryDTO }) {
  const cards = [
    { label: "Invoices", value: String(s.total), tone: "text-slate-900" },
    { label: "Matched", value: String(s.matched), tone: "text-emerald-600" },
    { label: "Exceptions", value: String(s.exceptions), tone: "text-rose-600" },
    { label: "Total value", value: money(s.totalValue), tone: "text-slate-900" },
    { label: "Exception value", value: money(s.exceptionValue), tone: "text-rose-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label} className="p-4">
          <div className={`text-xl font-semibold ${c.tone}`}>{c.value}</div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</div>
        </Card>
      ))}
    </div>
  );
}

const emptyForm = {
  vendorId: "",
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  subtotal: "",
  taxAmount: "0",
  totalAmount: "",
  poNumber: "",
  poAmount: "",
  grnNumber: "",
  grnAmount: "",
  note: "",
};

function RecordInvoiceForm({ vendors, onDone }: { vendors: VendorSummaryDTO[]; onDone: () => void }) {
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  const numOrUndef = (v: string) => (v.trim() === "" ? undefined : Number(v));

  async function submit() {
    setError(null);
    if (!form.vendorId) return setError("Select a vendor.");
    if (!form.invoiceNumber.trim()) return setError("Enter an invoice number.");
    if (form.totalAmount.trim() === "" || form.subtotal.trim() === "") return setError("Enter subtotal and total.");
    setBusy(true);
    try {
      await createInvoice(form.vendorId, {
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: new Date(form.invoiceDate).toISOString(),
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        currency: "INR",
        subtotal: Number(form.subtotal),
        taxAmount: Number(form.taxAmount || 0),
        totalAmount: Number(form.totalAmount),
        poNumber: form.poNumber.trim() || undefined,
        poAmount: numOrUndef(form.poAmount),
        grnNumber: form.grnNumber.trim() || undefined,
        grnAmount: numOrUndef(form.grnAmount),
        note: form.note.trim() || undefined,
      });
      setForm({ ...emptyForm });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record invoice");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm";
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Record invoice</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-500 sm:col-span-1">
          <span className="mb-1 block font-medium">Vendor</span>
          <select value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)} className={input}>
            <option value="">Select…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.legalName}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Invoice #</span>
          <input value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Invoice date</span>
          <input type="date" value={form.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Due date</span>
          <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Subtotal</span>
          <input type="number" value={form.subtotal} onChange={(e) => set("subtotal", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Tax</span>
          <input type="number" value={form.taxAmount} onChange={(e) => set("taxAmount", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Total</span>
          <input type="number" value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">PO number</span>
          <input value={form.poNumber} onChange={(e) => set("poNumber", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">PO amount</span>
          <input type="number" value={form.poAmount} onChange={(e) => set("poAmount", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">GRN number</span>
          <input value={form.grnNumber} onChange={(e) => set("grnNumber", e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">GRN amount</span>
          <input type="number" value={form.grnAmount} onChange={(e) => set("grnAmount", e.target.value)} className={input} />
        </label>
      </div>
      {error && <div className="mt-2"><ErrorText>{error}</ErrorText></div>}
      <div className="mt-3">
        <Button disabled={busy} onClick={() => void submit()}>{busy ? "Recording…" : "Record & reconcile"}</Button>
      </div>
    </Card>
  );
}

function PaymentForm({ invoice, onDone, onCancel }: { invoice: InvoiceDTO; onDone: () => void; onCancel: () => void }) {
  const [amount, setAmount] = useState(String(invoice.outstanding));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await recordPayment(invoice.id, {
        amount: Number(amount),
        paymentDate: new Date(date).toISOString(),
        method,
        reference: reference.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm";
  return (
    <Card className="border-indigo-200 bg-indigo-50/40">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">
        Record payment · {invoice.invoiceNumber} <span className="text-slate-400">({invoice.vendorName})</span>
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Bookkeeping entry for a payment already made. Outstanding: {money(invoice.outstanding, invoice.currency)}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Amount</span>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-32 ${input}`} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Method</span>
          <input value={method} onChange={(e) => setMethod(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          <span className="mb-1 block font-medium">Reference</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={input} />
        </label>
        <Button disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : "Record payment"}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
      {error && <div className="mt-2"><ErrorText>{error}</ErrorText></div>}
    </Card>
  );
}

const sevTone: Record<string, Parameters<typeof Badge>[0]["tone"]> = { HIGH: "danger", MEDIUM: "progress", LOW: "neutral" };

function FinanceControlSection({ control }: { control: FinanceControlDTO }) {
  const { leakage, exceptions } = control;
  return (
    <>
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Cash leakage exposure</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total at risk", value: leakage.total, tone: "text-rose-600" },
            { label: "Duplicate risk", value: leakage.duplicateValue, tone: "text-rose-600" },
            { label: "Overbilling", value: leakage.overbillingValue, tone: "text-amber-600" },
            { label: "MSMED exposure", value: leakage.msmedExposure, tone: "text-amber-600" },
          ].map((c) => (
            <Card key={c.label} className="p-4">
              <div className={`text-lg font-semibold ${c.tone}`}>{money(c.value)}</div>
              <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</div>
            </Card>
          ))}
        </div>
      </div>
      <Card className="p-0">
        <div className="border-b border-slate-100 p-4 text-sm font-semibold text-slate-700">
          Finance exceptions ({exceptions.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exceptions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No open exceptions. 🎉</td></tr>
              ) : (
                exceptions.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2"><Badge tone={sevTone[e.severity]}>{e.severity}</Badge></td>
                    <td className="px-4 py-2 text-slate-700">{financeExceptionLabels[e.type]}</td>
                    <td className="px-4 py-2">
                      <Link to={`/vendors/${e.vendorId}`} className="text-indigo-600 hover:underline">{e.vendorName}</Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{e.invoiceNumber}</td>
                    <td className="px-4 py-2 text-slate-700">{money(e.amount)}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{e.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function FinancePage() {
  const { user } = useAuth();
  const [control, setControl] = useState<FinanceControlDTO | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [summary, setSummary] = useState<InvoiceSummaryDTO | null>(null);
  const [vendors, setVendors] = useState<VendorSummaryDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [payFor, setPayFor] = useState<InvoiceDTO | null>(null);
  const [params, setParams] = useSearchParams();
  const vendorFilter = params.get("vendor") ?? "ALL";

  const finance = isFinance(user?.role);

  function load() {
    Promise.all([listAllInvoices(), getInvoiceSummary()])
      .then(([inv, sum]) => {
        setInvoices(inv);
        setSummary(sum);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    if (finance) {
      listVendors().then(setVendors).catch(() => {});
      getFinanceControl().then(setControl).catch(() => {});
    }
  }
  useEffect(load, [finance]);

  const rows = useMemo(
    () =>
      invoices
        .filter((i) => filter === "ALL" || i.status === filter)
        .filter((i) => vendorFilter === "ALL" || i.vendorId === vendorFilter),
    [invoices, filter, vendorFilter],
  );
  const vendorName = vendorFilter !== "ALL" ? rows[0]?.vendorName ?? vendors.find((v) => v.id === vendorFilter)?.legalName : null;

  async function act(id: string, status: "APPROVED" | "CANCELLED") {
    try {
      await setInvoiceStatus(id, status);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-slate-900">Finance control center</h1>
      {error && <ErrorText>{error}</ErrorText>}
      {summary && <SummaryCards s={summary} />}
      {finance && control && <FinanceControlSection control={control} />}
      {finance && payFor && (
        <PaymentForm invoice={payFor} onCancel={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />
      )}
      {finance && !payFor && <RecordInvoiceForm vendors={vendors} onDone={load} />}

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <span className="text-sm font-semibold text-slate-700">Invoices</span>
          {vendorName && (
            <Badge tone="info">
              {vendorName}
              <button className="ml-2 text-indigo-500 hover:underline" onClick={() => { params.delete("vendor"); setParams(params); }}>✕</button>
            </Badge>
          )}
          <select
            value={vendorFilter}
            onChange={(e) => { if (e.target.value === "ALL") params.delete("vendor"); else params.set("vendor", e.target.value); setParams(params); }}
            className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="ALL">All vendors</option>
            {[...new Map(invoices.map((i) => [i.vendorId, i.vendorName])).entries()].map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {["ALL", "RECEIVED", "MATCHED", "EXCEPTION", "APPROVED", "PAID", "CANCELLED"].map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All statuses" : invoiceStatusLabels[s as keyof typeof invoiceStatusLabels]}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Status</th>
                {finance && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={finance ? 8 : 7} className="px-4 py-8 text-center text-slate-400">No invoices.</td></tr>
              ) : (
                rows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{inv.invoiceNumber}</div>
                      <button
                        className="text-xs text-indigo-600 hover:underline"
                        onClick={() => void downloadInvoicePdf(inv.id, inv.invoiceNumber)}
                      >
                        ⬇ Invoice PDF
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/vendors/${inv.vendorId}`} className="text-indigo-600 hover:underline">{inv.vendorName}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-700">{money(inv.totalAmount, inv.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-700">{money(inv.outstanding, inv.currency)}</span>
                        <span className="flex gap-1">
                          {inv.isMsme && <Badge tone="info">MSME</Badge>}
                          {inv.overdue && <Badge tone="danger">Overdue</Badge>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {inv.matchStatus ? (
                        <Badge tone={inv.matchStatus === "MATCHED" ? "success" : "danger"}>
                          {matchStatusLabels[inv.matchStatus]}
                          {inv.varianceAmount ? ` (${money(inv.varianceAmount, inv.currency)})` : ""}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    {finance && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {inv.status === "MATCHED" && (
                            <Button variant="secondary" onClick={() => void act(inv.id, "APPROVED")}>Approve</Button>
                          )}
                          {inv.outstanding > 0 && inv.status !== "EXCEPTION" && inv.status !== "CANCELLED" && (
                            <Button variant="secondary" onClick={() => setPayFor(inv)}>Pay</Button>
                          )}
                          {inv.status !== "PAID" && inv.status !== "CANCELLED" && inv.amountPaid === 0 && (
                            <Button variant="secondary" onClick={() => void act(inv.id, "CANCELLED")}>Cancel</Button>
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
    </div>
  );
}
