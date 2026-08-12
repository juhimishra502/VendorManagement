import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { VendorLedgerDTO } from "@vendor-management/shared";
import { downloadLedgerXlsx, downloadReconciliationXlsx, getVendorLedger } from "../lib/finance.js";
import { money } from "../routes/finance.js";
import { Badge, Button, Card } from "./ui.js";

// Derived vendor ledger (internal only): invoices vs payments, running balance.
export function LedgerCard({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const [ledger, setLedger] = useState<VendorLedgerDTO | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getVendorLedger(vendorId)
      .then(setLedger)
      .catch(() => setError(true));
  }, [vendorId]);

  if (error) return null;
  if (!ledger) return null;
  if (ledger.entries.length === 0) return null;

  const safeName = vendorName.replace(/\s+/g, "-");

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ledger &amp; reconciliation</h2>
        {ledger.isMsme && <Badge tone="info">MSME · 45-day term</Badge>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void downloadLedgerXlsx(vendorId, safeName)}>
          ⬇ Ledger (XLSX)
        </Button>
        <Button variant="secondary" onClick={() => void downloadReconciliationXlsx(vendorId, safeName)}>
          ⬇ Reconciliation (XLSX)
        </Button>
        <Link to={`/finance?vendor=${vendorId}`}>
          <Button variant="secondary">Open in Finance →</Button>
        </Link>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-lg font-semibold text-slate-900">{money(ledger.totalInvoiced)}</div>
          <div className="text-xs text-slate-500">Invoiced (net)</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-emerald-600">{money(ledger.totalPaid)}</div>
          <div className="text-xs text-slate-500">Paid</div>
        </div>
        <div>
          <div className={`text-lg font-semibold ${ledger.overdueValue > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {money(ledger.outstanding)}
          </div>
          <div className="text-xs text-slate-500">
            Outstanding{ledger.overdueValue > 0 ? ` · ${money(ledger.overdueValue)} overdue` : ""}
          </div>
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1">Date</th>
              <th className="py-1">Ref</th>
              <th className="py-1 text-right">Debit</th>
              <th className="py-1 text-right">Credit</th>
              <th className="py-1 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ledger.entries.map((e, i) => (
              <tr key={i}>
                <td className="py-1 text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                <td className="py-1 text-slate-700">{e.reference}</td>
                <td className="py-1 text-right text-slate-700">{e.debit ? money(e.debit) : "—"}</td>
                <td className="py-1 text-right text-emerald-600">{e.credit ? money(e.credit) : "—"}</td>
                <td className="py-1 text-right font-medium text-slate-800">{money(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
