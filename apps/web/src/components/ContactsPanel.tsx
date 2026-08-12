import { useState } from "react";
import { contactTypes, contactTypeLabels, type ContactType, type VendorDetailDTO } from "@vendor-management/shared";
import { removeContact, upsertContact } from "../lib/vendors.js";
import { Button, ErrorText, Field, TextInput } from "./ui.js";

export function ContactsPanel({
  vendor,
  canEdit,
  onChange,
}: {
  vendor: VendorDetailDTO;
  canEdit: boolean;
  onChange: (v: VendorDetailDTO) => void;
}) {
  const [type, setType] = useState<ContactType>("PRIMARY");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Enter a contact name.");
      return;
    }
    setBusy(true);
    try {
      onChange(await upsertContact(vendor.id, { type, name: name.trim(), email: email.trim(), phone: phone.trim() }));
      setName("");
      setEmail("");
      setPhone("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save contact");
    } finally {
      setBusy(false);
    }
  }

  async function del(contactId: string) {
    setError(null);
    try {
      onChange(await removeContact(vendor.id, contactId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove contact");
    }
  }

  return (
    <div>
      {vendor.contacts.length === 0 ? (
        <p className="text-sm text-slate-400">No contacts yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {vendor.contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium text-slate-800">
                  {c.name} <span className="text-xs font-normal text-slate-400">· {c.typeLabel}</span>
                </div>
                <div className="text-xs text-slate-500">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              {canEdit && (
                <Button variant="ghost" onClick={() => del(c.id)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add / update a contact</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ContactType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {contactTypes.map((t) => (
                  <option key={t} value={t}>
                    {contactTypeLabels[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          {error ? <div className="mt-2"><ErrorText>{error}</ErrorText></div> : null}
          <div className="mt-2">
            <Button variant="secondary" disabled={busy} onClick={add}>
              {busy ? "Saving…" : "Save contact"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
