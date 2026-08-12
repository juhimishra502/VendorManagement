import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createVendorSchema, supplierTiers, supplierTierLabels, type SupplierTier } from "@vendor-management/shared";
import { createVendor } from "../lib/vendors.js";
import { Button, Card, ErrorText, Field, TextInput } from "../components/ui.js";

export function CreateVendorPage() {
  const navigate = useNavigate();
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState<SupplierTier | "">("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = createVendorSchema.safeParse({
      legalName,
      displayName: displayName || undefined,
      category: category || undefined,
      tier: tier || undefined,
      contactEmail: contactEmail || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    try {
      const vendor = await createVendor(parsed.data);
      navigate(`/vendors/${vendor.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vendor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Create vendor</h1>
      <p className="text-sm text-slate-500">An onboarding case is opened automatically for the new vendor.</p>

      <Card>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Legal name">
            <TextInput value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
          </Field>
          <Field label="Display name (optional)">
            <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Automotive category (optional)">
            <TextInput
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Metal Stamping, Wiring Harnesses, Brake Systems"
            />
          </Field>
          <Field label="Supplier tier (optional)">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as SupplierTier | "")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {supplierTiers.map((t) => (
                <option key={t} value={t}>
                  {supplierTierLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vendor contact email (optional)">
            <TextInput type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </Field>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <div className="flex gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create vendor"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
