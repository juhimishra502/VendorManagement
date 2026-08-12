import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { submitOnboardingSchema, type DraftOnboardingInput, type VendorDetailDTO } from "@vendor-management/shared";
import { getVendor, saveOnboardingDraft, submitOnboarding } from "../lib/vendors.js";
import { ApiError } from "../lib/http.js";
import { Button, Card, ErrorText, Field, StatusBadge, TextInput } from "../components/ui.js";
import { OnboardingProgress } from "../components/Progress.js";
import { VerificationSummary } from "../components/VerificationSummary.js";
import { DocumentsPanel } from "../components/DocumentsPanel.js";
import { ContactsPanel } from "../components/ContactsPanel.js";

const emptyForm = {
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  pan: "",
  gstin: "",
  udyam: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankName: "",
  // Business / capability (optional)
  tradeName: "",
  website: "",
  corporateAddress: "",
  businessType: "",
  ownershipStructure: "",
  products: "",
  components: "",
  manufacturingCapability: "",
  annualCapacity: "",
  leadTimeDays: "",
  qualityCertifications: "",
  complianceNotes: "",
};
type FormState = typeof emptyForm;

const CAPABILITY_KEYS: (keyof FormState)[] = [
  "tradeName",
  "website",
  "corporateAddress",
  "businessType",
  "ownershipStructure",
  "products",
  "components",
  "manufacturingCapability",
  "annualCapacity",
  "leadTimeDays",
  "qualityCertifications",
  "complianceNotes",
];

// Vendor-facing labels for the internal review functions (mock terminology).
const APPROVAL_LABELS: Record<string, string> = {
  FINANCE: "Finance",
  TAX: "Tax",
  LEGAL: "Legal",
  QUALITY: "Quality",
};

function Section({ title, letter, children }: { title: string; letter: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-900 text-xs font-bold text-white">{letter}</span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

export function VendorPortalPage() {
  const { id = "" } = useParams();
  const [vendor, setVendor] = useState<VendorDetailDTO | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyVendor = useCallback((v: VendorDetailDTO) => {
    setVendor(v);
    if (v.submission) {
      setForm((f) => ({
        ...f,
        contactName: v.submission?.contactName ?? "",
        contactEmail: v.submission?.contactEmail ?? "",
        contactPhone: v.submission?.contactPhone ?? "",
        addressLine1: v.submission?.addressLine1 ?? "",
        city: v.submission?.city ?? "",
        state: v.submission?.state ?? "",
        postalCode: v.submission?.postalCode ?? "",
        country: v.submission?.country ?? "India",
        pan: v.submission?.pan ?? "",
        gstin: v.submission?.gstin ?? "",
        udyam: v.submission?.udyam ?? "",
        bankAccountName: v.submission?.bankAccountName ?? "",
        bankAccountNumber: v.submission?.bankAccountNumber ?? "",
        bankIfsc: v.submission?.bankIfsc ?? "",
        bankName: v.submission?.bankName ?? "",
        tradeName: v.submission?.tradeName ?? "",
        website: v.submission?.website ?? "",
        corporateAddress: v.submission?.corporateAddress ?? "",
        businessType: v.submission?.businessType ?? "",
        ownershipStructure: v.submission?.ownershipStructure ?? "",
        products: v.submission?.products ?? "",
        components: v.submission?.components ?? "",
        manufacturingCapability: v.submission?.manufacturingCapability ?? "",
        annualCapacity: v.submission?.annualCapacity ?? "",
        leadTimeDays: v.submission?.leadTimeDays != null ? String(v.submission.leadTimeDays) : "",
        qualityCertifications: v.submission?.qualityCertifications ?? "",
        complianceNotes: v.submission?.complianceNotes ?? "",
      }));
    }
  }, []);

  useEffect(() => {
    getVendor(id)
      .then(applyVendor)
      .catch((e) =>
        setLoadError({ status: e instanceof ApiError ? e.status : 0, message: e instanceof Error ? e.message : "Failed to load" }),
      )
      .finally(() => setLoading(false));
  }, [id, applyVendor]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setOk(false);
    // Drop empty optional capability fields so they don't coerce (e.g. leadTimeDays "").
    const cleaned: Record<string, unknown> = { ...form };
    for (const k of CAPABILITY_KEYS) if (!String(cleaned[k] ?? "").trim()) delete cleaned[k];
    const parsed = submitOnboardingSchema.safeParse(cleaned);
    if (!parsed.success) {
      setFormError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · "));
      return;
    }
    setBusy(true);
    try {
      applyVendor(await submitOnboarding(id, parsed.data));
      setOk(true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  // Save & resume: persist only the non-empty fields as a draft (no submit).
  async function saveDraft() {
    setFormError(null);
    setSaved(false);
    const payload: DraftOnboardingInput = {};
    for (const [key, value] of Object.entries(form)) {
      if (value && value.trim()) (payload as Record<string, string>)[key] = value.trim();
    }
    setSaving(true);
    try {
      applyVendor(await saveOnboardingDraft(id, payload));
      setSaved(true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save progress");
    } finally {
      setSaving(false);
    }
  }

  // ---- Load / error / empty states -----------------------------------------
  if (loading) return <p className="text-slate-400">Loading your onboarding…</p>;
  if (loadError) {
    const msg =
      loadError.status === 403
        ? "You don’t have access to this onboarding case."
        : loadError.status === 404
          ? "This vendor could not be found."
          : loadError.status === 401
            ? "Please sign in to continue."
            : loadError.message;
    return (
      <div className="mx-auto max-w-lg">
        <ErrorText>{msg}</ErrorText>
        <Link to="/" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
          ← Back
        </Link>
      </div>
    );
  }
  if (!vendor) return null;

  const locked = vendor.onboardingStatus === "IN_APPROVAL" || vendor.status === "VERIFIED";
  const showVerification = vendor.checks.length > 0;

  // Review & Submit gate — each section is Complete or Action required (from persisted data).
  const companyDone = !!(form.contactName && form.contactEmail && form.addressLine1 && form.city && form.state && form.postalCode);
  const statutoryDone = !!(form.pan && form.gstin && form.udyam);
  const bankDone = !!(form.bankAccountName && form.bankAccountNumber && form.bankIfsc && form.bankName);
  const docsDone = vendor.requiredDocuments.every((d) => d.uploaded);
  const reviewSections = [
    { label: "Company information", done: companyDone },
    { label: "Statutory information", done: statutoryDone },
    { label: "Bank information", done: bankDone },
    { label: "Documents", done: docsDone },
  ];
  const readyToSubmit = reviewSections.every((s) => s.done);

  return (
    <div className="space-y-4">
      <Link to={`/vendors/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← Vendor overview
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{vendor.legalName}</h1>
          <p className="text-sm text-slate-500">Vendor onboarding portal</p>
        </div>
        <StatusBadge status={vendor.onboardingStatus} />
      </div>

      {vendor.status === "VERIFIED" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="font-semibold text-emerald-900">✓ Onboarding complete</p>
          <p className="text-sm text-emerald-800">
            Your company is verified{vendor.sapVendorId ? ` and registered (SAP ${vendor.sapVendorId})` : ""}. No further action is
            needed.
          </p>
        </Card>
      )}

      {vendor.onboardingStatus === "CHANGES_REQUESTED" && (
        <Card className="border-amber-300 bg-amber-50">
          <p className="font-semibold text-amber-900">Changes requested — please update and resubmit</p>
          <ul className="mt-1 space-y-1 text-sm text-amber-800">
            {vendor.approvals
              .filter((a) => a.status === "CHANGES_REQUESTED")
              .map((a) => (
                <li key={a.id}>
                  <strong>{a.function} review</strong>
                  {a.decidedByName ? ` (${a.decidedByName})` : ""}: {a.notes ?? "changes requested"}
                </li>
              ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left rail: progress + current action */}
        <div className="lg:col-span-1">
          <OnboardingProgress progress={vendor.progress} />
        </div>

        {/* Right: sections */}
        <div className="space-y-4 lg:col-span-2">
          {ok && (
            <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
              Details saved. Procurement can now run verification.
            </Card>
          )}

          {locked && vendor.status !== "VERIFIED" && (
            <Card className="text-sm text-slate-600">
              Your information is locked while verification/approval is in progress. You can still view your documents and status.
            </Card>
          )}

          <form className="space-y-4" onSubmit={submit}>
            <Section title="Company information" letter="A">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contact name">
                  <TextInput value={form.contactName} disabled={locked} onChange={(e) => set("contactName", e.target.value)} />
                </Field>
                <Field label="Contact email">
                  <TextInput type="email" value={form.contactEmail} disabled={locked} onChange={(e) => set("contactEmail", e.target.value)} />
                </Field>
                <Field label="Phone (optional)">
                  <TextInput value={form.contactPhone} disabled={locked} onChange={(e) => set("contactPhone", e.target.value)} />
                </Field>
                <Field label="Address line">
                  <TextInput value={form.addressLine1} disabled={locked} onChange={(e) => set("addressLine1", e.target.value)} />
                </Field>
                <Field label="City">
                  <TextInput value={form.city} disabled={locked} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="State">
                  <TextInput value={form.state} disabled={locked} onChange={(e) => set("state", e.target.value)} />
                </Field>
                <Field label="Postal code">
                  <TextInput value={form.postalCode} disabled={locked} onChange={(e) => set("postalCode", e.target.value)} />
                </Field>
                <Field label="Country">
                  <TextInput value={form.country} disabled={locked} onChange={(e) => set("country", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section title="Statutory information" letter="B">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="PAN">
                  <TextInput value={form.pan} disabled={locked} onChange={(e) => set("pan", e.target.value)} placeholder="ABCDE1234F" />
                </Field>
                <Field label="GSTIN">
                  <TextInput value={form.gstin} disabled={locked} onChange={(e) => set("gstin", e.target.value)} placeholder="27ABCDE1234F1Z5" />
                </Field>
                <Field label="Udyam number">
                  <TextInput value={form.udyam} disabled={locked} onChange={(e) => set("udyam", e.target.value)} placeholder="UDYAM-KA-00-0000000" />
                </Field>
              </div>
            </Section>

            <Section title="Bank information" letter="C">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Account holder name">
                  <TextInput value={form.bankAccountName} disabled={locked} onChange={(e) => set("bankAccountName", e.target.value)} />
                </Field>
                <Field label="Bank name">
                  <TextInput value={form.bankName} disabled={locked} onChange={(e) => set("bankName", e.target.value)} />
                </Field>
                <Field label="Account number">
                  <TextInput value={form.bankAccountNumber} disabled={locked} onChange={(e) => set("bankAccountNumber", e.target.value)} />
                </Field>
                <Field label="IFSC">
                  <TextInput value={form.bankIfsc} disabled={locked} onChange={(e) => set("bankIfsc", e.target.value)} placeholder="HDFC0001234" />
                </Field>
              </div>
            </Section>

            <Section title="Business & capability (optional)" letter="F">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Trade name">
                  <TextInput value={form.tradeName} disabled={locked} onChange={(e) => set("tradeName", e.target.value)} />
                </Field>
                <Field label="Website">
                  <TextInput value={form.website} disabled={locked} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
                </Field>
                <Field label="Business type">
                  <TextInput value={form.businessType} disabled={locked} onChange={(e) => set("businessType", e.target.value)} placeholder="e.g. Private limited" />
                </Field>
                <Field label="Ownership structure">
                  <TextInput value={form.ownershipStructure} disabled={locked} onChange={(e) => set("ownershipStructure", e.target.value)} />
                </Field>
                <Field label="Corporate address">
                  <TextInput value={form.corporateAddress} disabled={locked} onChange={(e) => set("corporateAddress", e.target.value)} />
                </Field>
                <Field label="Annual capacity">
                  <TextInput value={form.annualCapacity} disabled={locked} onChange={(e) => set("annualCapacity", e.target.value)} placeholder="e.g. 2M units/yr" />
                </Field>
                <Field label="Lead time (days)">
                  <TextInput value={form.leadTimeDays} disabled={locked} onChange={(e) => set("leadTimeDays", e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
                <Field label="Quality certifications">
                  <TextInput value={form.qualityCertifications} disabled={locked} onChange={(e) => set("qualityCertifications", e.target.value)} placeholder="e.g. IATF 16949, ISO 9001" />
                </Field>
                <Field label="Products">
                  <TextInput value={form.products} disabled={locked} onChange={(e) => set("products", e.target.value)} />
                </Field>
                <Field label="Components">
                  <TextInput value={form.components} disabled={locked} onChange={(e) => set("components", e.target.value)} />
                </Field>
                <Field label="Manufacturing capability">
                  <TextInput value={form.manufacturingCapability} disabled={locked} onChange={(e) => set("manufacturingCapability", e.target.value)} />
                </Field>
                <Field label="Compliance notes">
                  <TextInput value={form.complianceNotes} disabled={locked} onChange={(e) => set("complianceNotes", e.target.value)} />
                </Field>
              </div>
            </Section>

            {/* E. Review & submit */}
            {!locked && (
              <Section title="Review & submit" letter="E">
                <ul className="mb-3 space-y-1.5">
                  {reviewSections.map((s) => (
                    <li key={s.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{s.label}</span>
                      {s.done ? (
                        <span className="font-medium text-emerald-600">✓ Complete</span>
                      ) : (
                        <span className="font-medium text-amber-600">Action required</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-slate-600">
                  {readyToSubmit
                    ? "Your onboarding is ready to submit. Submitting sends it for verification."
                    : "Complete every section above (including all required documents) before submitting."}
                </p>
                {formError ? (
                  <div className="mt-3">
                    <ErrorText>{formError}</ErrorText>
                  </div>
                ) : null}
                {saved && <p className="mt-2 text-sm text-emerald-700">Progress saved. You can return anytime to continue.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy || !readyToSubmit}>
                    {busy ? "Submitting…" : vendor.submission?.submittedAt ? "Resubmit for verification" : "Submit onboarding"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={saving} onClick={saveDraft}>
                    {saving ? "Saving…" : "Save & continue later"}
                  </Button>
                </div>
              </Section>
            )}
          </form>

          {/* D. Documents */}
          <Section title="Documents" letter="D">
            <DocumentsPanel vendor={vendor} canEdit={vendor.viewerCanEdit} canReview={false} onChange={applyVendor} />
          </Section>

          {/* Vendor contacts */}
          <Card>
            <h2 className="mb-2 text-base font-semibold text-slate-900">Contacts</h2>
            <ContactsPanel vendor={vendor} canEdit={vendor.viewerCanEdit && !locked} onChange={applyVendor} />
          </Card>

          {/* Verification & approvals status — the post-submission status tracker */}
          {showVerification && (
            <Card>
              <h2 className="mb-1 text-base font-semibold text-slate-900">Verification results</h2>
              <VerificationSummary items={vendor.verificationSummary} />
            </Card>
          )}

          {/* Approvals status: vendors track the internal review pipeline live,
              without seeing reviewer identities or internal notes. */}
          {vendor.approvals.length > 0 && (
            <Card>
              <h2 className="mb-1 text-base font-semibold text-slate-900">Approvals status</h2>
              <p className="mb-2 text-sm text-slate-500">Internal review progress for your onboarding.</p>
              <ul className="divide-y divide-slate-100">
                {vendor.approvals.map((a) => (
                  <li key={a.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{APPROVAL_LABELS[a.function] ?? a.function}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.status === "CHANGES_REQUESTED" && a.notes && (
                      <div className="mt-1.5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <span className="font-semibold">Requested correction:</span> {a.notes}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
