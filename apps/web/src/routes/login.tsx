import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { Brand } from "../components/Brand.js";

/**
 * Full-viewport split-screen login. LEFT = branded forest panel with layered
 * product-fragment cards; RIGHT = the authentication form. All authentication
 * logic (sign-in / sign-up toggle, fields, redirect) is preserved unchanged —
 * this is a presentation-only redesign.
 */
export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp(name, email, password);
      else await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-cream-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      {/* RIGHT — authentication */}
      <main className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:min-h-screen">
        {/* logo shown on top for mobile/tablet, where the left panel is hidden */}
        <div className="lg:hidden">
          <Brand size={30} />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="vx-rise w-full max-w-md py-10">
            <h1 className="font-display text-3xl text-forest-900 sm:text-4xl">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-forest-600">
              {isSignup
                ? "Set up your Vendrax workspace to start onboarding vendors."
                : "Sign in to continue managing your vendor operations."}
            </p>

            <form className="mt-8 space-y-5" onSubmit={submit}>
              {isSignup && (
                <Field label="Name">
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    autoComplete="name"
                    placeholder="Jane Doe"
                  />
                </Field>
              )}
              <Field label="Email">
                <input
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password">
                <input
                  className={inputClass}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder="••••••••"
                />
              </Field>

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-900/15 transition-all duration-150 hover:-translate-y-0.5 hover:bg-indigo-700 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {busy ? (
                  <>
                    <Spinner /> {isSignup ? "Creating account…" : "Signing in…"}
                  </>
                ) : (
                  <>
                    {isSignup ? "Create account" : "Sign in"} <ArrowRight />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-sm text-forest-600">
              {isSignup ? "Already have an account? " : "New to Vendrax? "}
              <button
                type="button"
                className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
                onClick={() => {
                  setMode(isSignup ? "signin" : "signup");
                  setError(null);
                }}
              >
                {isSignup ? "Sign in" : "Create an account"}
              </button>
            </p>

            <div className="mt-10 border-t border-cream-200 pt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-forest-700">
                <ShieldIcon /> Secure vendor operations workspace
              </div>
              <p className="mt-1.5 text-xs text-forest-500">Enterprise-ready · Role-based access · Audit-ready</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------- left panel */

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-b from-forest-700 to-forest-900 p-12 text-cream-50 lg:flex lg:flex-col lg:justify-between xl:p-16">
      {/* botanical + dotted decoration */}
      <Leaf className="right-[-70px] top-[-50px] h-[360px] w-[360px] rotate-[20deg]" />
      <Leaf className="bottom-[-90px] left-[-80px] h-[320px] w-[320px] -rotate-[15deg]" />
      <Dots className="right-10 top-1/2 hidden xl:block" />

      <div className="vx-rise relative z-10">
        <Brand size={34} onDark />
      </div>

      <div className="relative z-10 max-w-md">
        <h2 className="vx-rise font-display text-4xl leading-[1.1] text-cream-50" style={{ animationDelay: "0.05s" }}>
          Vendor operations, without the operational chaos.
        </h2>
        <p className="vx-rise mt-5 text-lg leading-relaxed text-sage-200" style={{ animationDelay: "0.12s" }}>
          One connected workspace for vendor onboarding, verification, approvals, finance and performance.
        </p>

        {/* layered product fragments */}
        <div className="relative z-10 mt-12 max-w-sm space-y-4">
          <VendorVerifiedCard />
          <PerformanceCard />
          <FinanceExceptionCard />
        </div>
      </div>

      <div className="vx-rise relative z-10 flex items-center gap-2 text-sm text-sage-300" style={{ animationDelay: "0.3s" }}>
        <PipelineStrip />
      </div>
    </aside>
  );
}

function VendorVerifiedCard() {
  return (
    <div className="vx-rise -rotate-[1deg] rounded-2xl border border-forest-100 bg-white p-4 text-forest-900 shadow-xl shadow-black/20" style={{ animationDelay: "0.18s" }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-forest-400">Vendor verified</div>
          <div className="mt-0.5 font-semibold">SpeedLine Components</div>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Check />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-forest-600">
        {["GST verified", "PAN verified", "Bank verified"].map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className="text-emerald-600">
              <Check size={13} />
            </span>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function PerformanceCard() {
  return (
    <div className="vx-rise ml-12 rotate-[1.2deg] rounded-2xl border border-forest-100 bg-white p-4 text-forest-900 shadow-xl shadow-black/20" style={{ animationDelay: "0.26s" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-forest-400">Vendor performance</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-forest-800">82</span>
            <span className="text-sm text-forest-400">/ 100</span>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Good</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: "82%" }} />
      </div>
    </div>
  );
}

function FinanceExceptionCard() {
  return (
    <div className="vx-rise ml-4 -rotate-[0.6deg] rounded-2xl border border-forest-100 bg-white p-4 text-forest-900 shadow-xl shadow-black/20" style={{ animationDelay: "0.34s" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-forest-400">Finance exception</div>
          <div className="mt-0.5 text-xl font-bold text-forest-800">₹2.84 Cr</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Requires attention
        </span>
      </div>
    </div>
  );
}

function PipelineStrip() {
  const stages = ["Invited", "Verify", "Approve", "Active"];
  return (
    <div className="flex items-center gap-2">
      {stages.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${i === stages.length - 1 ? "bg-indigo-400" : "bg-sage-400"}`} />
            <span className="text-xs text-sage-300">{s}</span>
          </span>
          {i < stages.length - 1 && <span className="h-px w-5 bg-sage-500/50" />}
        </span>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- helpers */

const inputClass =
  "w-full rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-sm text-forest-900 shadow-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-forest-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-forest-700">{label}</span>
      {children}
    </label>
  );
}

function Leaf({ className = "" }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute z-0 ${className}`} viewBox="0 0 200 200" fill="none" aria-hidden>
      <path d="M100 190 C 55 160, 40 95, 55 40 C 100 65, 120 130, 100 190 Z" fill="#6f8f76" opacity="0.16" />
      <path d="M100 190 C 145 160, 160 95, 145 40 C 100 65, 80 130, 100 190 Z" fill="#eef3ef" opacity="0.06" />
      <path d="M100 190 V 55" stroke="#eef3ef" strokeWidth="2" opacity="0.1" />
    </svg>
  );
}

function Dots({ className = "" }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute z-0 ${className}`} width="120" height="120" aria-hidden>
      <defs>
        <pattern id="vx-login-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#8da893" opacity="0.4" />
        </pattern>
      </defs>
      <rect width="120" height="120" fill="url(#vx-login-dots)" />
    </svg>
  );
}

function Check({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-0.5">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-emerald-600">
      <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
