import type { ReactNode } from "react";

const toneClasses: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  progress: "bg-amber-50 text-amber-700 ring-amber-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function statusTone(status: string | null | undefined): keyof typeof toneClasses {
  switch (status) {
    case "VERIFIED":
    case "PASSED":
    case "APPROVED":
      return "success";
    case "VERIFICATION_FAILED":
    case "FAILED":
    case "REJECTED":
    case "BLOCKED":
      return "danger";
    case "COMPLETED":
    case "SHORTLISTED":
      return "success";
    case "REQUESTED":
    case "IN_REVIEW":
      return "info";
    case "IN_APPROVAL":
    case "VERIFICATION_IN_PROGRESS":
    case "IN_PROGRESS":
    case "PENDING":
      return "progress";
    case "INFO_SUBMITTED":
    case "VERIFICATION_PASSED":
    case "ONBOARDING":
      return "info";
    default:
      return "neutral";
  }
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof toneClasses }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

// Canonical DB states -> human-readable UI labels (Task 6: map, don't rename state).
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ONBOARDING: "Onboarding",
  CREATED: "Not started",
  IN_PROGRESS: "In progress",
  INFO_SUBMITTED: "Information submitted",
  VERIFICATION_IN_PROGRESS: "Verification in progress",
  VERIFICATION_PASSED: "Checks passed",
  VERIFICATION_FAILED: "Verification failed",
  IN_APPROVAL: "Awaiting approvals",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  PENDING: "Pending review",
  PASSED: "Passed",
  FAILED: "Failed",
  APPROVED: "Approved",
  MISSING: "Missing",
  NOT_RUN: "Not verified yet",
  // Business request statuses
  REQUESTED: "Requested",
  IN_REVIEW: "In review",
  SHORTLISTED: "Shortlisted",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

export function humanStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <Badge tone={statusTone(status)}>{humanStatus(status)}</Badge>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>
  );
}

export function Button({
  children,
  type = "button",
  variant = "primary",
  disabled,
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const variants: Record<string, string> = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300",
    secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-300",
    ghost: "text-indigo-600 hover:underline",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{children}</p>;
}

export function ProgressPill({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <span className="text-sm text-slate-600">
      {label}: <strong className="text-slate-900">{done}</strong>/{total}
    </span>
  );
}
