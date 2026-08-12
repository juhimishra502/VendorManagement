import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedLayout } from "./components/Layout.js";
import { useAuth } from "./lib/auth.js";
import { LandingPage } from "./routes/landing.js";
import { LoginPage } from "./routes/login.js";
import { OnboardPage } from "./routes/onboard.js";
import { RoleHome, MyOnboardingPage } from "./routes/role-home.js";
import { VendorsPage } from "./routes/dashboard.js";
import { CreateVendorPage } from "./routes/create-vendor.js";
import { VendorDetailPage } from "./routes/vendor-detail.js";
import { VendorPortalPage } from "./routes/vendor-portal.js";
import { VerificationPage } from "./routes/verification.js";
import { ApprovalsPage } from "./routes/approvals.js";
import { ApproverQueuePage } from "./routes/approvals-queue.js";
import { ActivityPage } from "./routes/activity.js";
import { RequestsPage, NewRequestPage } from "./routes/requests.js";
import { FinancePage } from "./routes/finance.js";
import { AdminPage } from "./routes/admin.js";
import { DevRolesPage } from "./routes/dev-roles.js";

/**
 * Public root: logged-out visitors see the marketing landing page; authenticated
 * users are sent into the app (RoleHome routes them by role). While the session
 * is still resolving we render the landing page to avoid a flash of nothing.
 */
function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LandingPage />;
  return user ? <Navigate to="/home" replace /> : <LandingPage />;
}

// Dev-only route: only registered in development builds (import.meta.env.DEV).
const protectedChildren = [
  { path: "/home", element: <RoleHome /> },
  { path: "/vendors", element: <VendorsPage /> },
  { path: "/vendors/new", element: <CreateVendorPage /> },
  { path: "/vendors/:id", element: <VendorDetailPage /> },
  { path: "/vendors/:id/portal", element: <VendorPortalPage /> },
  { path: "/vendors/:id/verification", element: <VerificationPage /> },
  { path: "/vendors/:id/approvals", element: <ApprovalsPage /> },
  { path: "/approvals", element: <ApproverQueuePage /> },
  { path: "/activity", element: <ActivityPage /> },
  { path: "/requests", element: <RequestsPage /> },
  { path: "/requests/new", element: <NewRequestPage /> },
  { path: "/finance", element: <FinancePage /> },
  { path: "/admin", element: <AdminPage /> },
  { path: "/my", element: <MyOnboardingPage /> },
  ...(import.meta.env.DEV ? [{ path: "/dev/roles", element: <DevRolesPage /> }] : []),
];

export const router = createBrowserRouter([
  { path: "/", element: <RootRoute /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/onboard/:token", element: <OnboardPage /> },
  { element: <ProtectedLayout />, children: protectedChildren },
  { path: "*", element: <Navigate to="/" replace /> },
]);
