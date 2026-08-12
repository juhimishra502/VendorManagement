import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NotificationDTO, UserRole } from "@vendor-management/shared";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications.js";

const INTERNAL_ROLES: UserRole[] = ["ADMIN", "PROCUREMENT", "FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"];

function timeAgo(iso: string): string {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    getUnreadCount()
      .then((r) => setCount(r.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 30_000);
    return () => clearInterval(t);
  }, [refreshCount]);

  // Close when clicking outside the panel.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      listNotifications(30)
        .then(setItems)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }

  async function onItemClick(n: NotificationDTO) {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.vendorId) {
      navigate(INTERNAL_ROLES.includes(role) ? `/vendors/${n.vendorId}` : "/my");
    }
  }

  async function onMarkAll() {
    await markAllNotificationsRead().catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setCount(0);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-800">Notifications</span>
            {items.some((x) => !x.read) && (
              <button type="button" onClick={() => void onMarkAll()} className="text-xs font-medium text-indigo-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-400">You're all caught up.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void onItemClick(n)}
                  className={`block w-full border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50 ${
                    n.read ? "" : "bg-indigo-50/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{n.title}</div>
                      {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</div>}
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                        {n.vendorName && <span className="truncate">{n.vendorName}</span>}
                        <span>· {timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
