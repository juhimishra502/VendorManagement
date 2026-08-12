import { useEffect, useState } from "react";
import { userRoles, type AdminUserDTO, type UserRole } from "@vendor-management/shared";
import { listUsers, setUserRole, runAlerts, exportVendorsCsv, exportInvoicesCsv } from "../lib/admin.js";
import { useAuth } from "../lib/auth.js";
import { Badge, Button, Card, ErrorText } from "../components/ui.js";

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

  function load() {
    if (isAdmin) listUsers().then(setUsers).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }
  useEffect(load, [isAdmin]);

  async function changeRole(id: string, role: UserRole) {
    setError(null);
    setNotice(null);
    try {
      await setUserRole(id, role);
      setNotice("Role updated.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change role");
    }
  }

  async function sweep() {
    setError(null);
    try {
      const r = await runAlerts();
      setNotice(`Alerts sent — ${r.contractsNotified} contract renewal(s), ${r.documentsNotified} document expiry alert(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run alerts");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-slate-900">Administration</h1>
      {error && <ErrorText>{error}</ErrorText>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Alerts & export</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void sweep()}>Run expiry &amp; renewal alerts</Button>
          <Button variant="secondary" onClick={() => void exportVendorsCsv()}>Export vendors (CSV)</Button>
          <Button variant="secondary" onClick={() => void exportInvoicesCsv()}>Export invoices (CSV)</Button>
        </div>
      </Card>

      {isAdmin && (
        <Card className="p-0">
          <div className="border-b border-slate-100 p-4 text-sm font-semibold text-slate-700">Users &amp; roles</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-800">{u.name}</td>
                    <td className="px-4 py-2 text-slate-500">{u.email}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="info">{u.role}</Badge>
                        <select
                          value={u.role}
                          onChange={(e) => void changeRole(u.id, e.target.value as UserRole)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          {userRoles.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
