import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { listVendors } from "../lib/vendors.js";
import { Card, ErrorText } from "../components/ui.js";
import { DashboardPage } from "./dashboard.js";

const APPROVER_ROLES = ["FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"];

/** Landing page differs by role: procurement → control tower, approver → queue, vendor → onboarding. */
export function RoleHome() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "VENDOR") return <Navigate to="/my" replace />;
  if (user.role === "BUSINESS") return <Navigate to="/requests" replace />;
  if (APPROVER_ROLES.includes(user.role)) return <Navigate to="/approvals" replace />;
  return <DashboardPage />;
}

/** Vendor entry point: sends them straight to their own onboarding portal. */
export function MyOnboardingPage() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "none" | "error">("loading");

  useEffect(() => {
    listVendors()
      .then((vs) => {
        if (vs[0]) setVendorId(vs[0].id);
        else setState("none");
      })
      .catch(() => setState("error"));
  }, []);

  if (vendorId) return <Navigate to={`/vendors/${vendorId}/portal`} replace />;
  if (state === "error") return <ErrorText>We couldn’t load your onboarding. Please try again.</ErrorText>;
  if (state === "none")
    return (
      <Card className="mx-auto max-w-lg text-sm text-slate-600">
        No onboarding case is linked to your account yet. Please contact your procurement contact so they can invite you.
      </Card>
    );
  return <p className="text-slate-400">Loading your onboarding…</p>;
}
