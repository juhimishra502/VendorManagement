import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { userRoles, type DevUserDTO, type UserRole } from "@vendor-management/shared";
import { assignRole, listUsers } from "../lib/dev.js";
import { useAuth } from "../lib/auth.js";
import { Badge, Card, ErrorText } from "../components/ui.js";

// DEV-ONLY screen. The route is only registered when import.meta.env.DEV is
// true, and the backend endpoints it calls are only mounted outside production.
export function DevRolesPage() {
  const { refresh } = useAuth();
  const [users, setUsers] = useState<DevUserDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function load() {
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"));
  }
  useEffect(load, []);

  async function change(userId: string, role: UserRole) {
    setError(null);
    setSavingId(userId);
    setSavedId(null);
    try {
      const updated = await assignRole(userId, role);
      setUsers((list) => list.map((u) => (u.id === userId ? updated : u)));
      setSavedId(userId);
      await refresh(); // in case you changed your own role
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign role");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>⚠ DEV ONLY.</strong> This role-assignment control exists to test the approval workflow locally. The
        backing API is not mounted in production.
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Assign roles (dev)</h1>
          <p className="text-sm text-slate-500">Change any user’s role, then sign in as them to test that function.</p>
        </div>
        <Link to="/" className="text-sm text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Current role</th>
                <th className="px-4 py-3">Set role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="info">{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) => change(u.id, e.target.value as UserRole)}
                      >
                        {userRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      {savingId === u.id && <span className="text-xs text-slate-400">saving…</span>}
                      {savedId === u.id && savingId !== u.id && <span className="text-xs text-emerald-600">saved ✓</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={3}>
                    No users yet — sign up some accounts first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
