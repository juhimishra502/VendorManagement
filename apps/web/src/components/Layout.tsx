import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@vendor-management/shared";
import { useAuth } from "../lib/auth.js";
import { Badge } from "./ui.js";
import { NotificationBell } from "./NotificationBell.js";
import { Brand } from "./Brand.js";

interface NavItem {
  label: string;
  to: string;
}

// Only show navigation the current role can actually use.
function navForRole(role: UserRole): NavItem[] {
  if (role === "PROCUREMENT" || role === "ADMIN") {
    return [
      { label: "Dashboard", to: "/home" },
      { label: "Vendors", to: "/vendors" },
      { label: "Requests", to: "/requests" },
      { label: "Approvals", to: "/approvals" },
      { label: "Finance", to: "/finance" },
      { label: "Activity", to: "/activity" },
      { label: "Admin", to: "/admin" },
    ];
  }
  if (role === "FINANCE") {
    return [
      { label: "My Approvals", to: "/approvals" },
      { label: "Finance", to: "/finance" },
      { label: "Activity", to: "/activity" },
    ];
  }
  if (role === "TAX" || role === "LEGAL" || role === "QUALITY" || role === "IT_SECURITY") {
    return [
      { label: "My Approvals", to: "/approvals" },
      { label: "Completed", to: "/approvals?scope=completed" },
      { label: "Activity", to: "/activity" },
    ];
  }
  if (role === "BUSINESS") {
    return [{ label: "My Requests", to: "/requests" }];
  }
  // VENDOR
  return [{ label: "My Onboarding", to: "/my" }];
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-sage-100 text-forest-800" : "text-forest-500 hover:bg-sage-50 hover:text-forest-800"
  }`;

export function ProtectedLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-forest-400">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const nav = navForRole(user.role);

  return (
    <div className="min-h-screen overflow-x-hidden bg-cream-50">
      <header className="sticky top-0 z-30 border-b border-forest-100 bg-cream-50/85 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-6">
            <Link to="/"><Brand /></Link>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell role={user.role} />
            {/* Desktop user cluster */}
            <div className="hidden items-center gap-3 lg:flex">
              {import.meta.env.DEV && (
                <Link
                  to="/dev/roles"
                  className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Dev: roles
                </Link>
              )}
              <div className="text-right">
                <div className="text-sm font-medium text-forest-800">{user.name}</div>
                <div className="text-xs text-forest-500">{user.email}</div>
              </div>
              <Badge tone="info">{user.role}</Badge>
              <button
                onClick={() => void signOut()}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-forest-800 ring-1 ring-inset ring-forest-200 transition hover:bg-sage-50"
              >
                Sign out
              </button>
            </div>
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="grid h-10 w-10 place-items-center rounded-lg text-forest-700 ring-1 ring-inset ring-forest-200 transition hover:bg-sage-50 lg:hidden"
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div className="border-t border-forest-100 bg-cream-50 px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-3 text-sm font-medium transition ${
                      isActive ? "bg-sage-100 text-forest-800" : "text-forest-600 hover:bg-sage-50"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 border-t border-forest-100 pt-3">
              <div className="text-sm font-medium text-forest-800">{user.name}</div>
              <div className="text-xs text-forest-500">{user.email}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="info">{user.role}</Badge>
                {import.meta.env.DEV && (
                  <Link
                    to="/dev/roles"
                    className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
                  >
                    Dev: roles
                  </Link>
                )}
              </div>
              <button
                onClick={() => void signOut()}
                className="mt-3 w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-forest-800 ring-1 ring-inset ring-forest-200 transition hover:bg-sage-50"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
