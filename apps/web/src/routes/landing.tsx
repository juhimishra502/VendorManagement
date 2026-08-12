import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Brand, VendraxMark } from "../components/Brand.js";

/**
 * Vendrax public marketing landing page. Static & self-contained (no API calls)
 * so it renders instantly for logged-out visitors. Full-bleed sections span the
 * viewport; content is capped at ~1360px. Palette: cream ground, forest
 * headings/nav, sage accents, blood-orange CTAs (the remapped `indigo-*` scale).
 */
export function LandingPage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-cream-50 text-forest-900">
      <TopBar />
      <Hero />
      <Workflow />
      <AttentionSection />
      <Vendor360 />
      <Integrations />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1360px] px-6 lg:px-12 ${className}`}>{children}</div>;
}

/**
 * Counts up to `target` on mount. Snaps straight to the final value when the
 * user prefers reduced motion or the tab is hidden (background tabs throttle
 * rAF, so animating there would leave a stale partial number on screen).
 */
function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || document.visibilityState !== "visible") {
      setVal(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const run = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(run);
      else setVal(target);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return { val, ref };
}

/** Soft botanical / dotted decoration that sits behind content. */
function Botanical({ className = "" }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute -z-0 ${className}`} viewBox="0 0 200 200" fill="none" aria-hidden>
      <path d="M100 190 C 55 160, 40 95, 55 40 C 100 65, 120 130, 100 190 Z" fill="#6f8f76" opacity="0.14" />
      <path d="M100 190 C 145 160, 160 95, 145 40 C 100 65, 80 130, 100 190 Z" fill="#274b37" opacity="0.10" />
      <path d="M100 190 V 55" stroke="#274b37" strokeWidth="2" opacity="0.12" />
    </svg>
  );
}

function Dots({ className = "" }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute -z-0 ${className}`} width="140" height="140" aria-hidden>
      <defs>
        <pattern id="vx-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill="#6f8f76" opacity="0.35" />
        </pattern>
      </defs>
      <rect width="140" height="140" fill="url(#vx-dots)" />
    </svg>
  );
}

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-0.5">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* --------------------------------------------------------------------- nav */

function TopBar() {
  const nav = ["Product", "Solutions", "Resources", "Pricing", "Company"];
  return (
    <header className="sticky top-0 z-40 border-b border-forest-100/70 bg-cream-50/80 backdrop-blur">
      <Container className="flex items-center justify-between py-4">
        <Link to="/" aria-label="Vendrax home">
          <Brand size={32} />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-forest-600 lg:flex">
          {nav.map((n) => (
            <a key={n} href="#platform" className="transition-colors hover:text-forest-900">
              {n}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-forest-700 transition-colors hover:text-forest-900">
            Log in
          </Link>
          <Link
            to="/login"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-900/10 transition-colors hover:bg-indigo-700"
          >
            Book a Demo <ArrowRight />
          </Link>
        </div>
      </Container>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section id="platform" className="relative overflow-hidden">
      <Botanical className="left-[-90px] top-[-40px] h-[420px] w-[420px] rotate-[18deg]" />
      <Dots className="right-6 top-24 hidden lg:block" />
      <Container className="relative grid items-center gap-14 py-16 lg:grid-cols-[1.02fr_1.1fr] lg:py-24">
        <div className="vx-rise">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Automotive Vendor Management</span>
          <h1 className="font-display mt-5 text-4xl leading-[1.04] text-forest-900 sm:text-5xl xl:text-[3.65rem]">
            Vendor operations, without the operational chaos.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-forest-600">
            Onboard, verify, approve, and monitor every vendor from one connected workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-900/15 transition-colors hover:bg-indigo-700"
            >
              Book a Demo <ArrowRight />
            </Link>
            <a
              href="#workflow"
              className="group inline-flex items-center gap-2 rounded-xl border border-forest-200 bg-white px-6 py-3.5 text-sm font-semibold text-forest-800 transition-colors hover:border-forest-300 hover:bg-sage-50"
            >
              Explore Platform <ArrowRight />
            </a>
          </div>
          <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-forest-500">
            {["Enterprise-grade security", "SOC 2 Type II compliant", "Loved by 500+ enterprises"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroDashboard />
      </Container>
    </section>
  );
}

function HeroDashboard() {
  return (
    <div className="relative">
      {/* soft glow behind the product visual */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-sage-200/50 via-cream-100 to-transparent blur-2xl" />

      <div className="vx-rise vx-lift relative rounded-2xl border border-forest-100 bg-white shadow-2xl shadow-forest-900/15" style={{ animationDelay: "0.1s" }}>
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-forest-100 bg-cream-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <VendraxMark size={22} />
            <span className="text-sm font-semibold text-forest-800">Procurement Control Tower</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
          </span>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total Vendors" value={428} tone="forest" />
            <Kpi label="Pending Approvals" value={13} tone="amber" />
            <Kpi label="Finance Exceptions" value={18} tone="rose" />
            <Kpi label="Onboarding in Progress" value={24} tone="orange" />
          </div>

          <div className="mt-5 rounded-xl border border-forest-100 bg-cream-50/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-forest-800">Pipeline Trend</span>
              <span className="text-xs font-medium text-forest-400">Last 6 stages</span>
            </div>
            <PipelineChart />
          </div>
        </div>
      </div>

      {/* floating notification cards — kept off the KPI numbers/chart data */}
      <FloatCard
        className="-top-5 left-[40%]"
        delay="0.5s"
        tone="emerald"
        title="Vendor verified"
        sub="SpeedLine Components"
      />
      <FloatCard
        className="top-[38%] -right-3 sm:-right-7"
        delay="0.8s"
        tone="forest"
        title="Approval complete"
        sub="Precision Gears Ltd."
      />
      <FloatCard
        className="-bottom-5 left-8"
        delay="1.1s"
        tone="amber"
        title="GST expires in 7 days"
        sub="Global Auto Parts"
      />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "forest" | "amber" | "rose" | "orange" }) {
  const { val, ref } = useCountUp(value);
  const color =
    tone === "orange" ? "text-indigo-600" : tone === "amber" ? "text-amber-600" : tone === "rose" ? "text-rose-600" : "text-forest-700";
  return (
    <div className="rounded-xl border border-forest-100 bg-white p-3.5">
      <span ref={ref} className={`text-2xl font-bold tabular-nums ${color}`}>
        {val}
      </span>
      <div className="mt-1 text-[11px] font-medium leading-tight text-forest-500">{label}</div>
    </div>
  );
}

const STAGES = ["Invited", "Information", "Verification", "Approvals", "ERP Handoff", "Active"];
function PipelineChart() {
  // Six stage counts (a funnel that narrows toward Active).
  const pts = [96, 78, 64, 47, 33, 24];
  const w = 520;
  const h = 96;
  const max = 100;
  const step = w / (pts.length - 1);
  const coords = pts.map((v, i) => [i * step, h - (v / max) * (h - 12) - 4]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="vx-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc5528" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#dc5528" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#vx-area)" />
        <path d={line} fill="none" stroke="#c8471f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="vx-draw" style={{ "--vx-len": "900" } as CSSProperties} />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke="#c8471f" strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between">
        {STAGES.map((s) => (
          <span key={s} className="w-0 flex-1 text-center text-[9px] font-medium text-forest-400">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function FloatCard({ className, delay, tone, title, sub }: { className: string; delay: string; tone: "emerald" | "forest" | "amber"; title: string; sub: string }) {
  const dot = { emerald: "bg-emerald-500", forest: "bg-forest-500", amber: "bg-amber-500" }[tone];
  const ring = { emerald: "text-emerald-700 bg-emerald-100", forest: "text-forest-700 bg-sage-100", amber: "text-amber-700 bg-amber-100" }[tone];
  return (
    <div className={`vx-float-in absolute z-20 hidden items-center gap-3 rounded-xl border border-forest-100 bg-white px-3.5 py-2.5 shadow-xl shadow-forest-900/10 sm:flex ${className}`} style={{ animationDelay: delay }}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${ring}`}>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
      </span>
      <div>
        <div className="whitespace-nowrap text-xs font-semibold text-forest-900">{title}</div>
        <div className="whitespace-nowrap text-[11px] text-forest-500">{sub}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- workflow */

const WORKFLOW: { title: string; body: string; icon: ReactNode }[] = [
  { title: "Invite", body: "Invite vendors in seconds.", icon: <IconInvite /> },
  { title: "Collect", body: "Gather documents & information.", icon: <IconCollect /> },
  { title: "Verify", body: "Automated checks & validation.", icon: <IconVerify /> },
  { title: "Approve", body: "Streamlined approvals with full visibility.", icon: <IconApprove /> },
  { title: "Activate", body: "Seamless ERP handoff.", icon: <IconActivate /> },
  { title: "Monitor", body: "Continuous oversight & performance.", icon: <IconMonitor /> },
];

function Workflow() {
  return (
    <section id="workflow" className="relative py-20 lg:py-28">
      <Container>
        <SectionHead
          eyebrow="How it works"
          title="One governed path from invite to payment"
          sub="Every vendor moves through the same six stages, so nothing slips through the cracks."
        />
        <div className="relative mt-14">
          {/* connecting line behind the icon row (desktop) */}
          <div className="absolute left-0 right-0 top-9 hidden h-0.5 bg-gradient-to-r from-forest-200 via-sage-300 to-forest-200 lg:block" />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
            {WORKFLOW.map((s, i) => (
              <li key={s.title} className="group relative flex flex-col items-center text-center">
                <span className="relative z-10 grid h-[72px] w-[72px] place-items-center rounded-2xl border border-forest-100 bg-white text-forest-700 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-900/15">
                  {s.icon}
                  <span className="absolute -bottom-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-forest-700 text-[11px] font-bold text-cream-50 transition-colors group-hover:bg-indigo-700">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 text-base font-semibold text-forest-900 transition-colors group-hover:text-indigo-700">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-forest-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- attention section */

function AttentionSection() {
  const rows = [
    { vendor: "Global Auto Parts", issue: "GST certificate expiring", cat: "Compliance", due: "in 7 days", sev: "High" },
    { vendor: "Bharat Forge Components", issue: "Invoice #BFC-0142 overdue", cat: "Finance", due: "12 days ago", sev: "High" },
    { vendor: "Rane Steering Systems", issue: "Awaiting Quality approval", cat: "Approval", due: "in 3 days", sev: "Medium" },
    { vendor: "Precision Gears Ltd.", issue: "PPAP report due", cat: "Performance", due: "in 9 days", sev: "Medium" },
    { vendor: "SpeedLine Components", issue: "Bank detail re-verification", cat: "Onboarding", due: "in 14 days", sev: "Low" },
  ] as const;
  const sev = {
    High: "bg-rose-100 text-rose-700",
    Medium: "bg-amber-100 text-amber-700",
    Low: "bg-emerald-100 text-emerald-700",
  };
  return (
    <section className="bg-cream-100/70 py-20 lg:py-28">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead align="left" eyebrow="Stay ahead" title="Vendors Requiring Attention" sub="Expiring certificates, overdue invoices and stalled approvals, surfaced automatically." />
          <Link to="/login" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            View All <ArrowRight />
          </Link>
        </div>
        <div className="mt-10 overflow-hidden rounded-2xl border border-forest-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-forest-100 bg-cream-50 text-xs font-semibold uppercase tracking-wide text-forest-500">
                  <th className="px-6 py-4">Vendor</th>
                  <th className="px-6 py-4">Issue</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-50">
                {rows.map((r) => (
                  <tr key={r.vendor} className="transition-colors hover:bg-sage-50/60">
                    <td className="px-6 py-4 font-semibold text-forest-900">{r.vendor}</td>
                    <td className="px-6 py-4 text-forest-600">{r.issue}</td>
                    <td className="px-6 py-4 text-forest-500">{r.cat}</td>
                    <td className="px-6 py-4 text-forest-500">{r.due}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sev[r.sev]}`}>{r.sev}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------- vendor 360 */

function Vendor360() {
  const caps = [
    { title: "Proactive risk detection", body: "Spot issues before they become problems." },
    { title: "Complete transparency", body: "360° visibility across the vendor lifecycle." },
    { title: "Stronger compliance", body: "Stay audit-ready, always." },
  ];
  return (
    <section className="relative py-20 lg:py-28">
      <Dots className="left-8 bottom-10 hidden lg:block" />
      <Container className="relative grid items-center gap-14 lg:grid-cols-2">
        <VendorProfilePreview />
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Vendor 360</span>
          <h2 className="font-display mt-4 text-3xl leading-tight text-forest-900 sm:text-4xl">
            Real visibility.
            <br />
            Real control.
          </h2>
          <p className="mt-5 max-w-md text-lg text-forest-600">
            A unified view of every vendor — their risks, documents, compliance, finance, and performance.
          </p>
          <ul className="mt-8 space-y-4">
            {caps.map((c) => (
              <li key={c.title} className="flex gap-4">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest-700">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <div className="font-semibold text-forest-900">{c.title}</div>
                  <div className="text-sm text-forest-600">{c.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function VendorProfilePreview() {
  const tabs = ["Overview", "Finance", "Performance", "Documents"];
  return (
    <div className="vx-lift rounded-2xl border border-forest-100 bg-white p-5 shadow-xl shadow-forest-900/10">
      <div className="flex items-center gap-3 border-b border-forest-100 pb-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest-700 text-lg font-bold text-cream-50">SC</span>
        <div>
          <div className="font-semibold text-forest-900">SpeedLine Components</div>
          <div className="text-xs text-forest-500">Tier 1 · Brake systems · Verified</div>
        </div>
        <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
      </div>
      <div className="mt-3 flex gap-1 text-xs font-medium">
        {tabs.map((t, i) => (
          <span key={t} className={`rounded-md px-2.5 py-1.5 ${i === 0 ? "bg-indigo-600 text-white" : "text-forest-500"}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MiniMetric label="Perf. score" value="92" tone="emerald" />
        <MiniMetric label="On-time" value="98%" tone="forest" />
        <MiniMetric label="Open risks" value="1" tone="amber" />
      </div>
      <div className="mt-3 space-y-2">
        {[
          ["GST certificate", "Valid", "emerald"],
          ["Quality (IATF 16949)", "Valid", "emerald"],
          ["Insurance", "Expiring soon", "amber"],
        ].map(([doc, st, tone]) => (
          <div key={doc} className="flex items-center justify-between rounded-lg border border-forest-50 px-3 py-2 text-sm">
            <span className="text-forest-700">{doc}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{st}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "emerald" | "forest" | "amber" }) {
  const c = { emerald: "text-emerald-600", forest: "text-forest-700", amber: "text-amber-600" }[tone];
  return (
    <div className="rounded-xl border border-forest-100 bg-cream-50 p-3 text-center">
      <div className={`text-xl font-bold ${c}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-forest-500">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------ integrations */

function Integrations() {
  const tiles = ["ERP", "Finance", "Compliance", "Contracts", "Analytics", "Slack", "Email", "API", "SSO", "Custom"];
  return (
    <section id="integrations" className="relative overflow-hidden bg-forest-800 py-20 text-cream-50 lg:py-28">
      <Botanical className="right-[-60px] top-[-40px] h-[360px] w-[360px] rotate-[-12deg] opacity-60" />
      <Container className="relative">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-sage-300">Integrations</span>
          <h2 className="font-display mt-4 text-3xl leading-tight text-cream-50 sm:text-4xl">
            Connect everything.
            <br />
            Automate anything.
          </h2>
          <p className="mt-5 text-lg text-sage-200">
            Seamlessly connect the tools you use and automate workflows that power faster, smarter vendor operations.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <div
              key={t}
              className="vx-lift flex items-center gap-3 rounded-xl border border-forest-600 bg-cream-50 px-4 py-4 text-forest-800 hover:border-indigo-300 hover:shadow-lg hover:shadow-black/20"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sage-100 text-forest-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-sm font-semibold">{t}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------- final cta */

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <Botanical className="left-[-70px] bottom-[-50px] h-[380px] w-[380px] rotate-[8deg]" />
      <Botanical className="right-[-70px] top-[-50px] h-[320px] w-[320px] rotate-[-20deg]" />
      <Container className="relative text-center">
        <h2 className="font-display mx-auto max-w-3xl text-4xl leading-[1.08] text-forest-900 sm:text-5xl">
          Your next vendor shouldn&apos;t take another week to onboard.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-forest-600">
          Let&apos;s build the smartest, fastest and more transparent supplier chain together.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-4 text-sm font-semibold text-white shadow-md shadow-indigo-900/15 transition-colors hover:bg-indigo-700"
          >
            Book a Demo <ArrowRight />
          </Link>
          <a
            href="#platform"
            className="group inline-flex items-center gap-2 rounded-xl border border-forest-200 bg-white px-7 py-4 text-sm font-semibold text-forest-800 transition-colors hover:border-forest-300 hover:bg-sage-50"
          >
            Explore Platform <ArrowRight />
          </a>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-forest-100 bg-cream-50">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-10 text-sm text-forest-500">
        <Brand size={26} />
        <span>© {new Date().getFullYear()} Vendrax — Vendor management for automotive supply chains.</span>
      </Container>
    </footer>
  );
}

/* --------------------------------------------------------------- primitives */

function SectionHead({ eyebrow, title, sub, align = "center" }: { eyebrow: string; title: string; sub: string; align?: "center" | "left" }) {
  const wrap = align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl";
  return (
    <div className={wrap}>
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">{eyebrow}</span>
      <h2 className="font-display mt-3 text-3xl leading-tight text-forest-900 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-forest-600">{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------- icons */

function IconInvite() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCollect() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h7l4 4v14H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v4h4M9.5 12h5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconVerify() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconApprove() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconActivate() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M13 3L4 14h7l-1 7 9-11h-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M4 17l4-5 3 3 5-7 4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
