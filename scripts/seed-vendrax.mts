/**
 * Vendrax demo seed — 10 automotive-industry vendors across the full lifecycle.
 *
 * IDEMPOTENT: every row uses a stable `vdx-` id and is upserted, so re-running
 * updates in place and never creates duplicates. It only touches `vdx-` rows and
 * the internal demo users (keyed by @vendrax.demo email); pre-existing data is
 * left untouched. Reuses the EXISTING Prisma models only.
 *
 * Run:  set -a && . ./.env && set +a && npx tsx scripts/seed-vendrax.mts
 */
import { prisma } from "@vendor-management/db";
import { computeOverallScore } from "@vendor-management/shared";

const DOC_B64 = Buffer.from("Vendrax demo document — synthetic evidence file.").toString("base64");
const DOC_BYTES = Buffer.from(DOC_B64, "base64").length;
const d = (s: string) => new Date(s + (s.length <= 10 ? "T10:00:00.000Z" : ""));
const addDays = (base: Date, n: number) => new Date(base.getTime() + n * 86_400_000);
const round2 = (n: number) => Math.round(n * 100) / 100;

// Collected updatedAt backdating (Prisma manages @updatedAt, so we set it via SQL).
const touch: { table: string; id: string; date: Date }[] = [];

// ---------------------------------------------------------------------------
// Internal demo team (keyed by unique email so it plays nicely with real logins)
// ---------------------------------------------------------------------------
async function ensureUser(idSlug: string, email: string, name: string, role: string): Promise<string> {
  // Upsert by stable id so an email change (e.g. vendor rename) updates in place.
  const u = await prisma.user.upsert({
    where: { id: `vdx-u-${idSlug}` },
    update: { name, email, role: role as never },
    create: { id: `vdx-u-${idSlug}`, email, name, role: role as never, emailVerified: true },
    select: { id: true },
  });
  return u.id;
}

async function main() {
  console.log("== Vendrax seed ==");
  const U = {
    admin: await ensureUser("admin", "admin@vendrax.demo", "Vendrax Admin", "ADMIN"),
    priya: await ensureUser("priya", "priya.nair@vendrax.demo", "Priya Nair", "PROCUREMENT"),
    arjun: await ensureUser("arjun", "arjun.rao@vendrax.demo", "Arjun Rao", "PROCUREMENT"),
    rahul: await ensureUser("rahul", "rahul.verma@vendrax.demo", "Rahul Verma", "FINANCE"),
    anita: await ensureUser("anita", "anita.desai@vendrax.demo", "Anita Desai", "TAX"),
    vikram: await ensureUser("vikram", "vikram.shah@vendrax.demo", "Vikram Shah", "LEGAL"),
    deepa: await ensureUser("deepa", "deepa.iyer@vendrax.demo", "Deepa Iyer", "QUALITY"),
    karan: await ensureUser("karan", "karan.malhotra@vendrax.demo", "Karan Malhotra", "IT_SECURITY"),
  };
  const FUNC_USER: Record<string, string> = { FINANCE: U.rahul, TAX: U.anita, LEGAL: U.vikram, QUALITY: U.deepa, IT_SECURITY: U.karan };

  // -------------------------------------------------------------------------
  // Vendor definitions (synthetic Indian automotive suppliers)
  // -------------------------------------------------------------------------
  type Stage =
    | "MATURE_HEALTHY" | "RENEWAL_DUE" | "ACTIVE_RECON_EXCEPTION" | "ACTIVE_INVOICE_EXCEPTION"
    | "MATURE_AT_RISK" | "AWAITING_APPROVAL" | "VERIFY_FAILED_GST" | "DOCS_PENDING"
    | "INFO_SUBMITTED_VERIFYING" | "NEWLY_INVITED";

  interface Inv { num: string; date: string; days: number; sub: number; match: string; status: string; poVar?: number; paid?: number; note?: string; }
  interface Perf { period: string; date: string; q: number; del: number; cost: number; resp: number; ppm: number; otif: number; inc: number; note: string; }
  interface V {
    n: number; slug: string; legalName: string; display: string; category: string; product: string;
    tier: string; contactName: string; email: string; phone: string; website: string;
    line1: string; city: string; state: string; postal: string;
    pan: string; gstin: string; udyam: string | null; bankName: string; accName: string; accNo: string; ifsc: string;
    terms: string; owner: string; created: string; stage: Stage;
    contractStart?: string; contractEnd?: string; contractValue?: number;
    invoices?: Inv[]; perf?: Perf[];
    prefix?: string; financeCr?: number; extras?: Inv[];
  }

  const isoDate = (dt: Date) => dt.toISOString().slice(0, 10);
  // Generate a realistic clean invoice portfolio whose totals sum to ~targetCr crore.
  // Current demo "today" — invoices are never dated beyond this.
  const NOW = d("2026-08-10");
  // Generate a clean invoice portfolio between a vendor's creation and NOW.
  // Invoice count scales with how long the vendor has been operating, so newly
  // onboarded vendors get a few recent invoices rather than a fabricated history.
  function buildPortfolio(prefix: string, createdISO: string, targetCr: number): Inv[] {
    const created = d(createdISO);
    const availableDays = Math.max(20, (NOW.getTime() - created.getTime()) / 86_400_000);
    const start = new Date(created.getTime() + Math.min(40, Math.round(availableDays * 0.15)) * 86_400_000);
    const spanDays = Math.max(10, (NOW.getTime() - start.getTime()) / 86_400_000);
    const n = Math.max(2, Math.min(14, Math.round(availableDays / 26)));
    const factorsBase = [0.82, 1.15, 0.94, 1.08, 1.22, 0.88, 1.05, 0.97, 1.18, 0.9, 1.12, 1.0, 0.85, 1.06];
    const factors = factorsBase.slice(0, n);
    const fsum = factors.reduce((a, b) => a + b, 0);
    const baseSubUnit = (targetCr * 1e7) / 1.18 / fsum;
    const invs: Inv[] = [];
    for (let i = 0; i < n; i++) {
      const sub = Math.round((baseSubUnit * factors[i]) / 1000) * 1000;
      const dt = new Date(start.getTime() + Math.round((i * spanDays) / Math.max(1, n - 1)) * 86_400_000);
      // Most invoices settled; a couple approved-outstanding; the latest awaiting match.
      const status = i < n - Math.min(4, n - 1) ? "PAID" : i < n - 2 ? "APPROVED" : "MATCHED";
      invs.push({ num: `${prefix}-${dt.getFullYear()}-${1001 + i}`, date: isoDate(dt), days: 45, sub, match: "MATCHED", status });
    }
    return invs;
  }

  const VENDORS: V[] = [
    {
      n: 1, slug: "v01", legalName: "Sundaram Brake Linings Pvt Ltd", display: "Sundaram Brake Linings", category: "Brake systems",
      product: "Brake pads, linings & disc assemblies", tier: "TIER1", contactName: "Ramesh Iyer", email: "ramesh.iyer@sundarambrakes.demo",
      phone: "+91 44 4567 1200", website: "https://sundarambrakes.demo", line1: "Plot 14, Ambattur Industrial Estate", city: "Chennai", state: "Tamil Nadu", postal: "600058",
      pan: "AABCS1234K", gstin: "33AABCS1234K1Z5", udyam: "UDYAM-TN-33-0012345", bankName: "HDFC Bank", accName: "Sundaram Brake Linings Pvt Ltd", accNo: "501000123456", ifsc: "HDFC0000123",
      terms: "Net 45", owner: U.priya, created: "2025-09-05", stage: "MATURE_HEALTHY",
      contractStart: "2025-09-10", contractEnd: "2027-03-31", contractValue: 450000000,
      prefix: "SBL", financeCr: 52, extras: [],
      perf: [
        { period: "2025-Q4", date: "2026-01-06", q: 88, del: 90, cost: 82, resp: 86, ppm: 140, otif: 96, inc: 1, note: "Consistent quality; strong OTIF." },
        { period: "2026-Q1", date: "2026-04-05", q: 90, del: 91, cost: 84, resp: 88, ppm: 110, otif: 97, inc: 0, note: "PPM improving quarter on quarter." },
        { period: "2026-Q2", date: "2026-07-05", q: 92, del: 93, cost: 85, resp: 90, ppm: 95, otif: 98, inc: 0, note: "Top-tier supplier; zero incidents." },
      ],
    },
    {
      n: 2, slug: "v02", legalName: "Rane Steering Systems Ltd", display: "Rane Steering Systems", category: "Steering & auto components",
      product: "Steering gears, columns & linkages", tier: "TIER1", contactName: "Lakshmi Narayan", email: "lakshmi.n@ranesteering.demo",
      phone: "+91 44 2811 3400", website: "https://ranesteering.demo", line1: "22 Guindy Industrial Area", city: "Chennai", state: "Tamil Nadu", postal: "600032",
      pan: "AADCR5678L", gstin: "33AADCR5678L1Z2", udyam: "UDYAM-TN-33-0023456", bankName: "ICICI Bank", accName: "Rane Steering Systems Ltd", accNo: "602000987654", ifsc: "ICIC0000456",
      terms: "Net 60", owner: U.arjun, created: "2025-09-22", stage: "RENEWAL_DUE",
      contractStart: "2025-09-25", contractEnd: "2026-09-01", contractValue: 380000000,
      prefix: "RSS", financeCr: 42, extras: [],
      perf: [
        { period: "2025-Q4", date: "2026-01-08", q: 85, del: 84, cost: 80, resp: 86, ppm: 210, otif: 93, inc: 2, note: "Reliable; minor cost pressure." },
        { period: "2026-Q1", date: "2026-04-08", q: 86, del: 85, cost: 82, resp: 85, ppm: 190, otif: 94, inc: 1, note: "Stable performance." },
        { period: "2026-Q2", date: "2026-07-08", q: 88, del: 87, cost: 83, resp: 87, ppm: 165, otif: 95, inc: 1, note: "Contract renewal window open." },
      ],
    },
    {
      n: 3, slug: "v03", legalName: "Amara Raja Battery Systems Pvt Ltd", display: "Amara Raja Battery Systems", category: "Batteries",
      product: "Automotive lead-acid & Li-ion batteries", tier: "TIER1", contactName: "Suresh Reddy", email: "suresh.reddy@amararajabat.demo",
      phone: "+91 8455 220 700", website: "https://amararajabat.demo", line1: "Renigunta Road, Karakambadi", city: "Tirupati", state: "Andhra Pradesh", postal: "517520",
      pan: "AAECA9012M", gstin: "37AAECA9012M1Z8", udyam: "UDYAM-AP-37-0045678", bankName: "Axis Bank", accName: "Amara Raja Battery Systems Pvt Ltd", accNo: "911020456789", ifsc: "UTIB0000789",
      terms: "Net 45", owner: U.priya, created: "2025-10-14", stage: "ACTIVE_RECON_EXCEPTION",
      contractStart: "2025-10-20", contractEnd: "2027-01-31", contractValue: 420000000,
      prefix: "ARB", financeCr: 46, extras: [
        { num: "ARB-2026-0102", date: "2026-04-02", days: 45, sub: 51500000, match: "PRICE_VARIANCE", status: "EXCEPTION", poVar: -1500000, note: "Invoice ₹15,00,000 above PO/GRN value — reconciliation exception." },
      ],
      perf: [
        { period: "2025-Q4", date: "2026-01-10", q: 74, del: 76, cost: 78, resp: 72, ppm: 380, otif: 88, inc: 3, note: "Recovering after early quality issues." },
        { period: "2026-Q1", date: "2026-04-10", q: 77, del: 78, cost: 79, resp: 76, ppm: 320, otif: 90, inc: 2, note: "Improving trend." },
        { period: "2026-Q2", date: "2026-07-10", q: 80, del: 81, cost: 80, resp: 78, ppm: 260, otif: 92, inc: 1, note: "On watch; reconciliation exception open." },
      ],
    },
    {
      n: 4, slug: "v04", legalName: "Sona Precision Fasteners Ltd", display: "Sona Precision Fasteners", category: "Fasteners",
      product: "High-tensile bolts, nuts & fasteners", tier: "TIER2", contactName: "Neha Gupta", email: "neha.gupta@sonafasteners.demo",
      phone: "+91 124 4890 300", website: "https://sonafasteners.demo", line1: "Sector 3, IMT Manesar", city: "Gurugram", state: "Haryana", postal: "122050",
      pan: "AAGCS3456N", gstin: "06AAGCS3456N1Z1", udyam: "UDYAM-HR-05-0034567", bankName: "State Bank of India", accName: "Sona Precision Fasteners Ltd", accNo: "300100223344", ifsc: "SBIN0001234",
      terms: "Net 30", owner: U.arjun, created: "2025-11-10", stage: "ACTIVE_INVOICE_EXCEPTION",
      contractStart: "2025-11-15", contractEnd: "2026-11-15", contractValue: 240000000,
      prefix: "SPF", financeCr: 30, extras: [
        { num: "SPF-2026-0051", date: "2026-05-04", days: 30, sub: 31800000, match: "DUPLICATE", status: "EXCEPTION", note: "Same PO/amount as an earlier invoice — possible duplicate." },
        { num: "SPF-2026-0052", date: "2026-03-15", days: 30, sub: 28000000, match: "MATCHED", status: "APPROVED", paid: 0, note: "MSME supplier — unpaid beyond the 45-day statutory term." },
      ],
      perf: [
        { period: "2025-Q4", date: "2026-01-12", q: 72, del: 70, cost: 76, resp: 74, ppm: 460, otif: 85, inc: 3, note: "MSME supplier; capacity constraints." },
        { period: "2026-Q1", date: "2026-04-12", q: 74, del: 73, cost: 77, resp: 75, ppm: 410, otif: 87, inc: 2, note: "Steady; watch payment ageing." },
        { period: "2026-Q2", date: "2026-07-12", q: 73, del: 74, cost: 76, resp: 74, ppm: 430, otif: 86, inc: 2, note: "MSMED payment breach flagged in finance." },
      ],
    },
    {
      n: 5, slug: "v05", legalName: "Endurance Castings & Tooling Pvt Ltd", display: "Endurance Castings & Tooling", category: "Forged/cast components & tooling",
      product: "Aluminium castings, forgings & tooling", tier: "TIER2", contactName: "Prakash Kulkarni", email: "prakash.k@endurancecast.demo",
      phone: "+91 20 6710 5500", website: "https://endurancecast.demo", line1: "K-228, MIDC Waluj", city: "Aurangabad", state: "Maharashtra", postal: "431136",
      pan: "AAFCE7890P", gstin: "27AAFCE7890P1Z6", udyam: "UDYAM-MH-27-0056789", bankName: "Bank of Baroda", accName: "Endurance Castings & Tooling Pvt Ltd", accNo: "220400556677", ifsc: "BARB0WALUJ0", // demo
      terms: "Net 45", owner: U.priya, created: "2025-12-08", stage: "MATURE_AT_RISK",
      contractStart: "2025-12-12", contractEnd: "2027-06-30", contractValue: 370000000,
      prefix: "ECT", financeCr: 40, extras: [
        { num: "ECT-2026-0064", date: "2026-04-20", days: 45, sub: 41000000, match: "MATCHED", status: "APPROVED", paid: 0, note: "Overdue past its due date — payment follow-up required." },
      ],
      perf: [
        { period: "2025-Q4", date: "2026-01-14", q: 64, del: 62, cost: 70, resp: 66, ppm: 720, otif: 79, inc: 5, note: "Delivery slippages and quality escapes." },
        { period: "2026-Q1", date: "2026-04-14", q: 60, del: 58, cost: 68, resp: 62, ppm: 810, otif: 76, inc: 6, note: "Deteriorating; escalated to supplier." },
        { period: "2026-Q2", date: "2026-07-14", q: 55, del: 52, cost: 62, resp: 60, ppm: 940, otif: 72, inc: 7, note: "At risk — recovery plan required." },
      ],
    },
    {
      n: 6, slug: "v06", legalName: "Varroc Engineering Components Pvt Ltd", display: "Varroc Engineering Components", category: "Automotive electrical & lighting",
      product: "Headlamps, alternators & electrical assemblies", tier: "TIER1", contactName: "Farah Khan", email: "farah.khan@varroc.demo",
      phone: "+91 240 663 4500", website: "https://varroc.demo", line1: "7 Padi Industrial Estate", city: "Chennai", state: "Tamil Nadu", postal: "600050",
      pan: "AAHCL2345Q", gstin: "33AAHCL2345Q1Z9", udyam: "UDYAM-TN-33-0067890", bankName: "Kotak Mahindra Bank", accName: "Lucas Electricals India Ltd", accNo: "412000778899", ifsc: "KKBK0000321",
      terms: "Net 45", owner: U.arjun, created: "2026-01-15", stage: "AWAITING_APPROVAL",
      contractStart: "2026-01-20", contractEnd: "2027-07-20", contractValue: 240000000,
      prefix: "VAR", financeCr: 25, extras: [
        { num: "VAR-2026-9001", date: "2026-05-08", days: 45, sub: 22000000, match: "PRICE_VARIANCE", status: "EXCEPTION", poVar: -900000, note: "Invoice ₹9,00,000 above PO/GRN value — reconciliation exception." },
      ],
    },
    {
      n: 7, slug: "v07", legalName: "Bharat Forge Components Pvt Ltd", display: "Bharat Forge Components", category: "Forged automotive components",
      product: "Crankshafts, front axles & forged components", tier: "TIER1", contactName: "Sanjay Deshpande", email: "sanjay.d@bharatforge.demo",
      phone: "+91 20 6704 2100", website: "https://bharatforge.demo", line1: "Gat 635, Koregaon Bhima", city: "Pune", state: "Maharashtra", postal: "412216",
      pan: "AAKCK6789R", gstin: "27AAKCK6789R1Z3", udyam: "UDYAM-MH-27-0078901", bankName: "Punjab National Bank", accName: "Kalyani Forge Components Ltd", accNo: "180500334455", ifsc: "PUNB0180500",
      terms: "Net 30", owner: U.priya, created: "2026-02-18", stage: "VERIFY_FAILED_GST",
      contractStart: "2026-02-25", contractEnd: "2028-02-25", contractValue: 180000000,
      prefix: "BFC", financeCr: 18, extras: [],
    },
    {
      n: 8, slug: "v08", legalName: "Motherson Automotive Systems Pvt Ltd", display: "Motherson Automotive Systems", category: "Wiring & electrical systems",
      product: "Wiring harnesses, mirrors & electrical modules", tier: "TIER1", contactName: "Meera Joshi", email: "meera.joshi@motherson.demo",
      phone: "+91 120 668 7000", website: "https://motherson.demo", line1: "GIDC Makarpura, Plot 88", city: "Vadodara", state: "Gujarat", postal: "390010",
      pan: "AALCB4567S", gstin: "24AALCB4567S1Z7", udyam: "UDYAM-GJ-11-0087654", bankName: "IDBI Bank", accName: "Bharat Rubber & Sealing Co", accNo: "260100112233", ifsc: "IBKL0000260",
      terms: "Net 30", owner: U.arjun, created: "2026-03-20", stage: "DOCS_PENDING",
      contractStart: "2026-03-25", contractEnd: "2027-09-25", contractValue: 150000000,
      prefix: "MAS", financeCr: 15, extras: [
        { num: "MAS-2026-9001", date: "2026-04-15", days: 30, sub: 15000000, match: "MATCHED", status: "APPROVED", paid: 0, note: "Overdue past the statutory term — payment follow-up required." },
      ],
    },
    {
      n: 9, slug: "v09", legalName: "Gabriel India Components Pvt Ltd", display: "Gabriel India Components", category: "Suspension & ride-control",
      product: "Shock absorbers, struts & suspension components", tier: "TIER2", contactName: "Rohit Sharma", email: "rohit.sharma@gabriel.demo",
      phone: "+91 20 3061 2400", website: "https://gabriel.demo", line1: "Plot 5, Sector 24 Faridabad", city: "Faridabad", state: "Haryana", postal: "121005",
      pan: "AAMCJ8901T", gstin: "06AAMCJ8901T1Z4", udyam: "UDYAM-HR-06-0089012", bankName: "Yes Bank", accName: "JBM Interior Systems Pvt Ltd", accNo: "017900445566", ifsc: "YESB0000179",
      terms: "Net 45", owner: U.priya, created: "2026-05-12", stage: "INFO_SUBMITTED_VERIFYING",
      contractStart: "2026-05-15", contractEnd: "2027-11-15", contractValue: 200000000,
      prefix: "GAB", financeCr: 22, extras: [],
    },
    {
      n: 10, slug: "v10", legalName: "Uno Minda Automotive Components Pvt Ltd", display: "Uno Minda Automotive Components", category: "Automotive components & electrical systems",
      product: "Switches, lighting & electronic assemblies", tier: "TIER1", contactName: "Ananya Verma", email: "ananya.verma@unominda.demo",
      phone: "+91 129 430 8800", website: "https://unominda.demo", line1: "B-64, Sector 63 Noida", city: "Noida", state: "Uttar Pradesh", postal: "201301",
      pan: "AANCM1234U", gstin: "09AANCM1234U1Z0", udyam: "UDYAM-UP-09-0090123", bankName: "HDFC Bank", accName: "Minda Automotive Electronics Ltd", accNo: "501000998877", ifsc: "HDFC0000999",
      terms: "Net 60", owner: U.arjun, created: "2026-07-08", stage: "NEWLY_INVITED",
      contractStart: "2026-07-12", contractEnd: "2027-07-12", contractValue: 100000000,
      prefix: "UNO", financeCr: 10, extras: [],
    },
  ];

  // Stage → onboarding configuration
  interface Cfg {
    company: boolean; statutory: boolean; bank: boolean; submitted: boolean; verified: boolean;
    docs: { type: string; status: string; expiry?: string }[];
    checks: Partial<Record<"PAN" | "GST" | "UDYAM" | "BANK", string>>;
    approvals: Partial<Record<"FINANCE" | "TAX" | "LEGAL" | "QUALITY" | "IT_SECURITY", string>>;
    onboarding: string; vendorStatus: string; erp: string; sap: boolean;
    invitation: string | null; blocker: string | null;
  }
  const ALL_DOCS = [
    { type: "PAN_CARD", status: "APPROVED" }, { type: "GST_CERTIFICATE", status: "APPROVED" },
    { type: "UDYAM_CERTIFICATE", status: "APPROVED" }, { type: "BANK_PROOF", status: "APPROVED" },
    { type: "ARTICLES_OF_INCORPORATION", status: "APPROVED" }, { type: "QUALITY_CERT", status: "APPROVED", expiry: "2026-09-30" },
  ];
  const ALL_PASS = { PAN: "PASSED", GST: "PASSED", UDYAM: "PASSED", BANK: "PASSED" };
  const ALL_APPROVED = { FINANCE: "APPROVED", TAX: "APPROVED", LEGAL: "APPROVED", QUALITY: "APPROVED", IT_SECURITY: "APPROVED" };
  const verifiedBase = (blocker: string | null = null): Cfg => ({
    company: true, statutory: true, bank: true, submitted: true, verified: true,
    docs: ALL_DOCS, checks: { ...ALL_PASS }, approvals: { ...ALL_APPROVED },
    onboarding: "VERIFIED", vendorStatus: "VERIFIED", erp: "SYNCED", sap: true, invitation: "OPENED", blocker,
  });

  function stageCfg(stage: Stage): Cfg {
    switch (stage) {
      case "MATURE_HEALTHY":
      case "RENEWAL_DUE":
      case "ACTIVE_RECON_EXCEPTION":
      case "ACTIVE_INVOICE_EXCEPTION":
      case "MATURE_AT_RISK":
        return verifiedBase();
      case "AWAITING_APPROVAL":
        return {
          company: true, statutory: true, bank: true, submitted: true, verified: false,
          docs: ALL_DOCS, checks: { ...ALL_PASS },
          approvals: { FINANCE: "APPROVED", TAX: "APPROVED", LEGAL: "PENDING", QUALITY: "CHANGES_REQUESTED", IT_SECURITY: "PENDING" },
          onboarding: "IN_APPROVAL", vendorStatus: "ONBOARDING", erp: "NOT_STARTED", sap: false, invitation: "OPENED",
          blocker: "Awaiting LEGAL and IT/Security approval; QUALITY requested changes to the IATF certificate.",
        };
      case "VERIFY_FAILED_GST":
        return {
          company: true, statutory: true, bank: true, submitted: true, verified: false,
          docs: [{ type: "PAN_CARD", status: "APPROVED" }, { type: "GST_CERTIFICATE", status: "REJECTED" }, { type: "UDYAM_CERTIFICATE", status: "APPROVED" }, { type: "BANK_PROOF", status: "APPROVED" }],
          checks: { PAN: "PASSED", GST: "FAILED", UDYAM: "PASSED", BANK: "PASSED" }, approvals: {},
          onboarding: "VERIFICATION_FAILED", vendorStatus: "ONBOARDING", erp: "NOT_STARTED", sap: false, invitation: "OPENED",
          blocker: "GST verification failed: legal name does not match GSTIN records. Vendor to correct GST details and resubmit.",
        };
      case "DOCS_PENDING":
        return {
          company: true, statutory: true, bank: true, submitted: false, verified: false,
          docs: [{ type: "PAN_CARD", status: "APPROVED" }, { type: "GST_CERTIFICATE", status: "PENDING" }],
          checks: {}, approvals: {},
          onboarding: "IN_PROGRESS", vendorStatus: "ONBOARDING", erp: "NOT_STARTED", sap: false, invitation: "OPENED",
          blocker: "Awaiting Udyam certificate and bank proof upload from the vendor.",
        };
      case "INFO_SUBMITTED_VERIFYING":
        return {
          company: true, statutory: true, bank: true, submitted: true, verified: false,
          docs: [{ type: "PAN_CARD", status: "APPROVED" }, { type: "GST_CERTIFICATE", status: "APPROVED" }, { type: "UDYAM_CERTIFICATE", status: "APPROVED" }, { type: "BANK_PROOF", status: "APPROVED" }],
          checks: { PAN: "PENDING", GST: "PENDING", UDYAM: "PENDING", BANK: "PENDING" }, approvals: {},
          onboarding: "VERIFICATION_IN_PROGRESS", vendorStatus: "ONBOARDING", erp: "NOT_STARTED", sap: false, invitation: "OPENED",
          blocker: "Statutory verification (PAN/GST/Udyam/Bank) in progress.",
        };
      case "NEWLY_INVITED":
        return {
          company: false, statutory: false, bank: false, submitted: false, verified: false,
          docs: [], checks: {}, approvals: {},
          onboarding: "CREATED", vendorStatus: "DRAFT", erp: "NOT_STARTED", sap: false, invitation: "SENT",
          blocker: "Invitation sent; awaiting the vendor to begin self-service onboarding.",
        };
    }
  }

  let sapCounter = 400100;
  for (const v of VENDORS) {
    const cfg = stageCfg(v.stage);
    const vid = `vdx-${v.slug}`;
    const created = d(v.created);
    const owner = v.owner;
    const events: { action: string; at: Date; actor: string; detail?: unknown }[] = [];

    // Vendor
    await prisma.vendor.upsert({
      where: { id: vid },
      update: {
        legalName: v.legalName, displayName: v.display, category: v.category, tier: v.tier as never,
        contactEmail: v.email, status: cfg.vendorStatus as never, createdById: owner,
        erpStatus: cfg.erp as never, sapVendorId: cfg.sap ? `SAP-${sapCounter}` : null,
        erpProvider: cfg.sap ? "mock-sap-s4hana" : null, erpSyncedAt: cfg.sap ? addDays(created, 14) : null, createdAt: created,
      },
      create: {
        id: vid, legalName: v.legalName, displayName: v.display, category: v.category, tier: v.tier as never,
        contactEmail: v.email, status: cfg.vendorStatus as never, createdById: owner,
        erpStatus: cfg.erp as never, sapVendorId: cfg.sap ? `SAP-${sapCounter}` : null,
        erpProvider: cfg.sap ? "mock-sap-s4hana" : null, erpSyncedAt: cfg.sap ? addDays(created, 14) : null, createdAt: created,
      },
    });
    if (cfg.sap) sapCounter++;
    events.push({ action: "VENDOR_CREATED", at: created, actor: owner, detail: { by: "seed" } });

    // Vendor portal user (matches contactEmail) — only for invited/started vendors
    const portalUserId = await ensureUser(`vend-${v.slug}`, v.email, v.contactName, "VENDOR");

    // Onboarding case
    const caseId = `vdx-oc-${v.slug}`;
    const caseData = {
      status: cfg.onboarding as never,
      contactName: cfg.company ? v.contactName : null, contactEmail: cfg.company ? v.email : null, contactPhone: cfg.company ? v.phone : null,
      addressLine1: cfg.company ? v.line1 : null, city: cfg.company ? v.city : null, state: cfg.company ? v.state : null,
      postalCode: cfg.company ? v.postal : null, country: cfg.company ? "India" : null,
      pan: cfg.statutory ? v.pan : null, gstin: cfg.statutory ? v.gstin : null, udyam: cfg.statutory ? v.udyam : null,
      bankAccountName: cfg.bank ? v.accName : null, bankAccountNumber: cfg.bank ? v.accNo : null, bankIfsc: cfg.bank ? v.ifsc : null, bankName: cfg.bank ? v.bankName : null,
      tradeName: v.display, website: v.website, corporateAddress: cfg.company ? `${v.line1}, ${v.city}, ${v.state} ${v.postal}` : null,
      businessType: "Private Limited", products: v.product, qualityCertifications: "IATF 16949, ISO 9001",
      leadTimeDays: 30 + v.n, submittedAt: cfg.submitted ? addDays(created, 7) : null, verifiedAt: cfg.verified ? addDays(created, 14) : null,
      currentBlocker: cfg.blocker, createdAt: created,
    };
    await prisma.onboardingCase.upsert({ where: { id: caseId }, update: { vendorId: vid, ...caseData }, create: { id: caseId, vendorId: vid, ...caseData } });

    // Contacts
    for (const [i, ct] of (["PRIMARY", "FINANCE", "QUALITY"] as const).entries()) {
      if (v.stage === "NEWLY_INVITED" && ct !== "PRIMARY") continue;
      await prisma.vendorContact.upsert({
        where: { id: `vdx-ct-${v.slug}-${ct}` },
        update: { vendorId: vid, type: ct as never, name: ct === "PRIMARY" ? v.contactName : `${v.display} ${ct[0]}${ct.slice(1).toLowerCase()} desk`, email: v.email, phone: v.phone },
        create: { id: `vdx-ct-${v.slug}-${ct}`, vendorId: vid, type: ct as never, name: ct === "PRIMARY" ? v.contactName : `${v.display} ${ct[0]}${ct.slice(1).toLowerCase()} desk`, email: v.email, phone: v.phone },
      });
    }

    // Invitation
    if (cfg.invitation) {
      const opened = cfg.invitation === "OPENED";
      await prisma.vendorInvitation.upsert({
        where: { id: `vdx-inv-${v.slug}` },
        update: { vendorId: vid, tokenHash: `vdx-tok-${v.slug}`, status: cfg.invitation as never, email: v.email, expiresAt: addDays(created, 30), openedAt: opened ? addDays(created, 3) : null, sentById: owner, createdAt: addDays(created, 1) },
        create: { id: `vdx-inv-${v.slug}`, vendorId: vid, tokenHash: `vdx-tok-${v.slug}`, status: cfg.invitation as never, email: v.email, expiresAt: addDays(created, 30), openedAt: opened ? addDays(created, 3) : null, sentById: owner, createdAt: addDays(created, 1) },
      });
      events.push({ action: "INVITATION_SENT", at: addDays(created, 1), actor: owner });
      if (opened) events.push({ action: "INVITATION_OPENED", at: addDays(created, 3), actor: portalUserId });
    }

    // Documents
    for (const doc of cfg.docs) {
      const id = `vdx-doc-${v.slug}-${doc.type}`;
      const label = doc.type.replace(/_/g, " ").toLowerCase();
      await prisma.document.upsert({
        where: { id },
        update: { vendorId: vid, type: doc.type as never, fileName: `${v.slug}-${doc.type.toLowerCase()}.pdf`, mimeType: "application/pdf", sizeBytes: DOC_BYTES, dataBase64: DOC_B64, status: doc.status as never, expiryDate: doc.expiry ? d(doc.expiry) : null, uploadedById: portalUserId, reviewNote: doc.status === "REJECTED" ? "GST certificate name mismatch — please re-upload." : null, reviewedAt: doc.status !== "PENDING" ? addDays(created, 8) : null, createdAt: addDays(created, 7) },
        create: { id, vendorId: vid, type: doc.type as never, fileName: `${v.slug}-${doc.type.toLowerCase()}.pdf`, mimeType: "application/pdf", sizeBytes: DOC_BYTES, dataBase64: DOC_B64, status: doc.status as never, expiryDate: doc.expiry ? d(doc.expiry) : null, uploadedById: portalUserId, reviewNote: doc.status === "REJECTED" ? "GST certificate name mismatch — please re-upload." : null, reviewedAt: doc.status !== "PENDING" ? addDays(created, 8) : null, createdAt: addDays(created, 7) },
      });
      events.push({ action: doc.status === "REJECTED" ? "DOCUMENT_REVIEWED" : "DOCUMENT_UPLOADED", at: addDays(created, 7), actor: portalUserId, detail: { type: doc.type } });
    }
    if (cfg.submitted) events.push({ action: "ONBOARDING_SUBMITTED", at: addDays(created, 7), actor: portalUserId });

    // Verification checks
    const provider: Record<string, string> = { PAN: "mock-nsdl-pan", GST: "mock-gstn", UDYAM: "mock-udyam", BANK: "mock-penny-drop" };
    for (const [type, status] of Object.entries(cfg.checks)) {
      const id = `vdx-vc-${v.slug}-${type}`;
      const failed = status === "FAILED";
      await prisma.verificationCheck.upsert({
        where: { id },
        update: { onboardingCaseId: caseId, type: type as never, status: status as never, provider: provider[type], reference: status === "PASSED" ? `${type}CHK-${v.n}${type}` : null, message: failed ? `${type} verification failed: name mismatch with official records.` : status === "PASSED" ? `${type} verified successfully.` : `${type} verification pending.`, result: { valid: status === "PASSED" }, checkedAt: status === "PENDING" ? null : addDays(created, 10) },
        create: { id, onboardingCaseId: caseId, type: type as never, status: status as never, provider: provider[type], reference: status === "PASSED" ? `${type}CHK-${v.n}${type}` : null, message: failed ? `${type} verification failed: name mismatch with official records.` : status === "PASSED" ? `${type} verified successfully.` : `${type} verification pending.`, result: { valid: status === "PASSED" }, checkedAt: status === "PENDING" ? null : addDays(created, 10) },
      });
    }
    const checkVals = Object.values(cfg.checks);
    if (checkVals.length && checkVals.every((s) => s === "PASSED")) events.push({ action: "VERIFICATION_PASSED", at: addDays(created, 10), actor: owner });
    else if (checkVals.includes("FAILED")) events.push({ action: "VERIFICATION_FAILED", at: addDays(created, 10), actor: owner });

    // Approval tasks
    for (const [fn, status] of Object.entries(cfg.approvals)) {
      const id = `vdx-ap-${v.slug}-${fn}`;
      const decided = status !== "PENDING";
      const notes = status === "CHANGES_REQUESTED" ? "Please provide the latest IATF 16949 certificate; the one on file has expired." : status === "REJECTED" ? "Rejected pending compliance clarification." : null;
      await prisma.approvalTask.upsert({
        where: { id },
        update: { onboardingCaseId: caseId, function: fn as never, status: status as never, decidedById: decided ? FUNC_USER[fn] : null, decidedAt: decided ? addDays(created, 12) : null, notes },
        create: { id, onboardingCaseId: caseId, function: fn as never, status: status as never, decidedById: decided ? FUNC_USER[fn] : null, decidedAt: decided ? addDays(created, 12) : null, notes },
      });
      if (status === "APPROVED") events.push({ action: "APPROVAL_APPROVED", at: addDays(created, 12), actor: FUNC_USER[fn], detail: { function: fn } });
      if (status === "CHANGES_REQUESTED") events.push({ action: "APPROVAL_CHANGES_REQUESTED", at: addDays(created, 12), actor: FUNC_USER[fn], detail: { function: fn } });
    }
    if (cfg.verified) events.push({ action: "SAP_HANDOFF", at: addDays(created, 14), actor: owner, detail: { sapVendorId: `SAP-${sapCounter - 1}` } });

    // Contract + obligations
    if (v.contractStart && v.contractEnd) {
      const cid = `vdx-con-${v.slug}`;
      const cStart = d(v.contractStart);
      await prisma.contract.upsert({
        where: { id: cid },
        update: { vendorId: vid, title: `${v.display} — Master Supply Agreement`, contractType: "Supply agreement", startDate: cStart, endDate: d(v.contractEnd), value: v.contractValue ?? null, currency: "INR", status: "ACTIVE" as never, autoRenew: false, renewalNoticeDays: v.stage === "RENEWAL_DUE" ? 60 : 30, terms: "Standard Vendrax master supply terms (demo).", createdById: U.vikram, createdAt: cStart },
        create: { id: cid, vendorId: vid, title: `${v.display} — Master Supply Agreement`, contractType: "Supply agreement", startDate: cStart, endDate: d(v.contractEnd), value: v.contractValue ?? null, currency: "INR", status: "ACTIVE" as never, autoRenew: false, renewalNoticeDays: v.stage === "RENEWAL_DUE" ? 60 : 30, terms: "Standard Vendrax master supply terms (demo).", createdById: U.vikram, createdAt: cStart },
      });
      await prisma.obligation.upsert({
        where: { id: `vdx-ob-${v.slug}-1` },
        update: { contractId: cid, description: "Submit quarterly quality (PPAP) report", dueDate: addDays(cStart, 90), status: (v.stage === "MATURE_AT_RISK" ? "BREACHED" : "MET") as never },
        create: { id: `vdx-ob-${v.slug}-1`, contractId: cid, description: "Submit quarterly quality (PPAP) report", dueDate: addDays(cStart, 90), status: (v.stage === "MATURE_AT_RISK" ? "BREACHED" : "MET") as never },
      });
      events.push({ action: "CONTRACT_CREATED", at: cStart, actor: U.vikram, detail: { title: v.display } });
    }

    // Invoices + payments — verified vendors get a full ~targetCr portfolio + exceptions
    const extrasCr = (v.extras ?? []).reduce((s, e) => s + (e.sub * 1.18) / 1e7, 0);
    const invoiceList: Inv[] = v.financeCr && v.prefix
      ? [...buildPortfolio(v.prefix, v.created, v.financeCr - extrasCr), ...(v.extras ?? [])]
      : v.invoices ?? [];
    // Drop any prior seed invoices for this vendor (numbers may have changed); payments cascade.
    const keepIds = invoiceList.map((inv) => `vdx-invc-${v.slug}-${inv.num}`);
    await prisma.invoice.deleteMany({ where: { vendorId: vid, id: { startsWith: `vdx-invc-${v.slug}-`, notIn: keepIds } } });
    for (const inv of invoiceList) {
      const id = `vdx-invc-${v.slug}-${inv.num}`;
      const gst = round2(inv.sub * 0.18);
      const total = round2(inv.sub + gst);
      const poAmount = inv.match === "PRICE_VARIANCE" ? round2(total + (inv.poVar ?? 0)) : total;
      const variance = inv.match === "PRICE_VARIANCE" ? Math.abs(round2(total - poAmount)) : null;
      const tds = round2(inv.sub * 0.02);
      const netPayable = round2(total - tds);
      const invDate = d(inv.date);
      const paid = inv.status === "PAID" ? netPayable : (inv.paid ?? 0);
      await prisma.invoice.upsert({
        where: { id },
        update: { vendorId: vid, invoiceNumber: inv.num, invoiceDate: invDate, dueDate: addDays(invDate, inv.days), currency: "INR", subtotal: inv.sub, taxAmount: gst, totalAmount: total, status: inv.status as never, poNumber: `PO-${v.slug.toUpperCase()}-${inv.num.slice(-4)}`, poAmount, grnNumber: inv.match === "MISSING_GRN" ? null : `GRN-${inv.num.slice(-4)}`, grnAmount: inv.match === "MISSING_GRN" ? null : poAmount, matchStatus: inv.match as never, varianceAmount: variance, note: inv.note ?? null, gstRate: 18, tdsRate: 2, tdsAmount: tds, netPayable, amountPaid: paid, createdById: U.rahul, createdAt: invDate },
        create: { id, vendorId: vid, invoiceNumber: inv.num, invoiceDate: invDate, dueDate: addDays(invDate, inv.days), currency: "INR", subtotal: inv.sub, taxAmount: gst, totalAmount: total, status: inv.status as never, poNumber: `PO-${v.slug.toUpperCase()}-${inv.num.slice(-4)}`, poAmount, grnNumber: inv.match === "MISSING_GRN" ? null : `GRN-${inv.num.slice(-4)}`, grnAmount: inv.match === "MISSING_GRN" ? null : poAmount, matchStatus: inv.match as never, varianceAmount: variance, note: inv.note ?? null, gstRate: 18, tdsRate: 2, tdsAmount: tds, netPayable, amountPaid: paid, createdById: U.rahul, createdAt: invDate },
      });
      events.push({ action: "INVOICE_RECORDED", at: invDate, actor: U.rahul, detail: { invoiceNumber: inv.num, matchStatus: inv.match } });
      if (inv.status === "PAID") {
        const payDate = addDays(invDate, Math.min(inv.days - 3, 40));
        await prisma.payment.upsert({
          where: { id: `vdx-pay-${v.slug}-${inv.num}` },
          update: { invoiceId: id, vendorId: vid, amount: netPayable, paymentDate: payDate, method: "NEFT", reference: `UTR${v.n}${inv.num.slice(-4)}`, recordedById: U.rahul, createdAt: payDate },
          create: { id: `vdx-pay-${v.slug}-${inv.num}`, invoiceId: id, vendorId: vid, amount: netPayable, paymentDate: payDate, method: "NEFT", reference: `UTR${v.n}${inv.num.slice(-4)}`, recordedById: U.rahul, createdAt: payDate },
        });
        events.push({ action: "PAYMENT_RECORDED", at: payDate, actor: U.rahul, detail: { invoiceNumber: inv.num, amount: netPayable } });
      }
    }

    // Performance reviews
    for (const p of v.perf ?? []) {
      const overall = computeOverallScore({ quality: p.q, delivery: p.del, cost: p.cost, responsiveness: p.resp });
      const pdate = d(p.date);
      await prisma.performanceReview.upsert({
        where: { id: `vdx-perf-${v.slug}-${p.period}` },
        update: { vendorId: vid, period: p.period, qualityScore: p.q, deliveryScore: p.del, costScore: p.cost, responsivenessScore: p.resp, overallScore: overall, ppm: p.ppm, otifPercent: p.otif, incidents: p.inc, note: p.note, reviewedById: U.deepa, createdAt: pdate },
        create: { id: `vdx-perf-${v.slug}-${p.period}`, vendorId: vid, period: p.period, qualityScore: p.q, deliveryScore: p.del, costScore: p.cost, responsivenessScore: p.resp, overallScore: overall, ppm: p.ppm, otifPercent: p.otif, incidents: p.inc, note: p.note, reviewedById: U.deepa, createdAt: pdate },
      });
      events.push({ action: "PERFORMANCE_REVIEW_RECORDED", at: pdate, actor: U.deepa, detail: { period: p.period, overallScore: overall } });
    }

    // Audit events (delete existing seed events for this vendor, re-insert deterministically)
    await prisma.auditLog.deleteMany({ where: { vendorId: vid, id: { startsWith: `vdx-au-${v.slug}-` } } });
    events.sort((a, b) => a.at.getTime() - b.at.getTime());
    await prisma.auditLog.createMany({
      data: events.map((e, i) => ({ id: `vdx-au-${v.slug}-${String(i).padStart(3, "0")}`, vendorId: vid, onboardingCaseId: caseId, actorId: e.actor, action: e.action, detail: (e.detail ?? {}) as never, createdAt: e.at })),
    });

    // Track last-touch for updatedAt backdating
    const last = events.length ? events[events.length - 1].at : created;
    touch.push({ table: "Vendor", id: vid, date: last });
    touch.push({ table: "OnboardingCase", id: caseId, date: last });
    console.log(`  ✓ ${v.legalName} — ${v.stage} (${events.length} events)`);
  }

  // -------------------------------------------------------------------------
  // Notifications (visible in the bell for the demo login users)
  // -------------------------------------------------------------------------
  const notifs = [
    { id: "vdx-nt-1", user: U.vikram, type: "APPROVAL_PENDING", title: "Approval pending: Lucas Electricals India", body: "Legal approval is pending for Lucas Electricals India.", vendor: "vdx-v06", read: false },
    { id: "vdx-nt-2", user: U.karan, type: "APPROVAL_PENDING", title: "Approval pending: Lucas Electricals India", body: "IT/Security approval is pending.", vendor: "vdx-v06", read: false },
    { id: "vdx-nt-3", user: U.priya, type: "VERIFICATION_FAILED", title: "Verification failed: Kalyani Forge Components", body: "GST verification failed — vendor correction required.", vendor: "vdx-v07", read: false },
    { id: "vdx-nt-4", user: U.rahul, type: "FINANCE_EXCEPTION", title: "Invoice exception: ARB-2026-0102", body: "Price variance on Amara Raja Battery Systems (₹15,000).", vendor: "vdx-v03", read: false },
    { id: "vdx-nt-5", user: U.rahul, type: "FINANCE_EXCEPTION", title: "Possible duplicate: SPF-2026-0051", body: "Sona Precision Fasteners — duplicate invoice indicator.", vendor: "vdx-v04", read: false },
    { id: "vdx-nt-6", user: U.priya, type: "CONTRACT_RENEWAL", title: "Contract renewal due: Rane Steering Systems", body: "Contract expires soon — review renewal.", vendor: "vdx-v02", read: false },
    { id: "vdx-nt-7", user: U.priya, type: "PERFORMANCE_ISSUE", title: "Performance at risk: Endurance Castings & Tooling", body: "2026-Q2 scorecard fell to At Risk.", vendor: "vdx-v05", read: false },
    { id: "vdx-nt-8", user: U.admin, type: "REMINDER", title: "10 demo vendors seeded", body: "Vendrax demo environment is populated.", vendor: null, read: true },
  ];
  for (const n of notifs) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: { userId: n.user, type: n.type as never, title: n.title, body: n.body, vendorId: n.vendor, read: n.read, relatedType: "seed" },
      create: { id: n.id, userId: n.user, type: n.type as never, title: n.title, body: n.body, vendorId: n.vendor, read: n.read, relatedType: "seed" },
    });
  }

  // Backdate updatedAt (Prisma manages @updatedAt automatically on write).
  for (const t of touch) {
    await prisma.$executeRawUnsafe(`UPDATE "${t.table}" SET "updatedAt" = $1 WHERE id = $2`, t.date, t.id);
  }

  const count = await prisma.vendor.count({ where: { id: { startsWith: "vdx-v" } } });
  console.log(`\nSeeded ${count} Vendrax demo vendors. Notifications: ${notifs.length}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("SEED FAILED:", e); await prisma.$disconnect(); process.exit(1); });
