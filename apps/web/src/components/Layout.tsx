import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@vendor-management/shared";
import { useAuth } from "../lib/auth.js";
import { Badge, Button } from "./ui.js";
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

export function ProtectedLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const nav = navForRole(user.role);

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-30 border-b border-forest-100 bg-cream-50/85 backdrop-blur">
        <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3 px-6 py-3 lg:px-10">
          <div className="flex items-center gap-6">
            <Link to="/"><Brand /></Link>
            <nav className="flex items-center gap-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      isActive ? "bg-sage-100 text-forest-800" : "text-forest-500 hover:bg-sage-50 hover:text-forest-800"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell role={user.role} />
            {import.meta.env.DEV && (
              <Link
                to="/dev/roles"
                className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                Dev: roles
              </Link>
            )}
            <div className="text-right">
              <div className="text-sm font-medium text-slate-800">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <Badge tone="info">{user.role}</Badge>
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="w-full px-6 py-8 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
