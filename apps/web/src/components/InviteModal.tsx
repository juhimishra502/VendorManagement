import { useState } from "react";
import type { VendorDetailDTO } from "@vendor-management/shared";
import { sendInvitation, type InvitationLink } from "../lib/vendors.js";
import { Button, ErrorText } from "./ui.js";

const MESSAGE =
  "Complete your supplier onboarding by submitting your company information, statutory details, bank details and required documents.";

export function InviteModal({
  vendor,
  onClose,
  onSent,
}: {
  vendor: VendorDetailDTO;
  onClose: () => void;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<InvitationLink | null>(null);
  const [copied, setCopied] = useState(false);
  const resend = !!vendor.invitation && !vendor.invitation.expired && vendor.invitation.status !== "REVOKED";

  async function send() {
    setError(null);
    setBusy(true);
    try {
      setSent(await sendInvitation(vendor.id));
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invitation");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(sent.link);
      setCopied(true);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">
          {resend ? "Resend onboarding invitation" : "Send onboarding invitation"}
        </h2>

        {!sent ? (
          <>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">Vendor</dt>
                <dd className="font-medium text-slate-800">{vendor.legalName}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">Contact person</dt>
                <dd className="font-medium text-slate-800">{vendor.submission?.contactName ?? "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-800">{vendor.contactEmail ?? "—"}</dd>
              </div>
              <div className="flex justify-between py-1.5">
                <dt className="text-slate-500">Expiry</dt>
                <dd className="font-medium text-slate-800">7 days</dd>
              </div>
            </dl>

            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{MESSAGE}”</p>
            {resend && (
              <p className="mt-2 text-xs text-amber-700">Resending replaces the previous link. Existing progress is preserved.</p>
            )}
            {!vendor.contactEmail && (
              <p className="mt-2 text-xs text-rose-600">This vendor has no contact email — add one before inviting.</p>
            )}
            {error ? <div className="mt-3"><ErrorText>{error}</ErrorText></div> : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy || !vendor.contactEmail} onClick={send}>
                {busy ? "Sending…" : resend ? "Resend invitation" : "Send invitation"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Invitation sent to <strong>{sent.email}</strong> · expires {new Date(sent.expiresAt).toLocaleDateString()}.
            </p>
            <p className="mt-3 text-sm text-slate-600">Secure onboarding link (share with the vendor):</p>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={sent.link}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="secondary" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
