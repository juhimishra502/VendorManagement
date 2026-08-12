import { useRef, useState } from "react";
import {
  allowedDocumentMimeTypes,
  maxDocumentBytes,
  type DocumentType,
  type VendorDetailDTO,
} from "@vendor-management/shared";
import { downloadDocument, reviewDocument, uploadDocument } from "../lib/vendors.js";
import { Badge, Button, StatusBadge } from "./ui.js";

function humanSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function DocumentsPanel({
  vendor,
  canEdit,
  canReview,
  onChange,
}: {
  vendor: VendorDetailDTO;
  canEdit: boolean;
  canReview: boolean;
  onChange: (v: VendorDetailDTO) => void;
}) {
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleFile(type: DocumentType, file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])) {
      setError(`Unsupported file type "${file.type || "unknown"}". Allowed: PDF, PNG, JPEG.`);
      return;
    }
    if (file.size > maxDocumentBytes) {
      setError(`"${file.name}" is ${humanSize(file.size)} — the limit is 1 MB.`);
      return;
    }
    setBusyType(type);
    try {
      onChange(await uploadDocument(vendor.id, type, file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyType(null);
    }
  }

  async function download(docId: string, fileName: string) {
    setError(null);
    try {
      await downloadDocument(docId, fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  async function review(docId: string, status: "APPROVED" | "REJECTED") {
    setError(null);
    setBusyType(docId);
    try {
      onChange(await reviewDocument(vendor.id, docId, status));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusyType(null);
    }
  }

  const editable = canEdit && vendor.status !== "VERIFIED";

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {error}
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {vendor.requiredDocuments.map((req) => {
          const doc = vendor.documents.find((d) => d.id === req.documentId);
          return (
            <li key={req.type} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{req.label}</span>
                  {req.status === "MISSING" ? (
                    <Badge tone="neutral">Missing</Badge>
                  ) : (
                    <StatusBadge status={req.status} />
                  )}
                </div>
                {doc && (
                  <p className="truncate text-xs text-slate-400">
                    {doc.fileName} · {humanSize(doc.sizeBytes)}
                    {doc.expiryState === "EXPIRED" ? (
                      <span className="ml-1 font-semibold text-rose-600">· EXPIRED</span>
                    ) : doc.expiryState === "EXPIRING_SOON" ? (
                      <span className="ml-1 font-semibold text-amber-600">· expiring soon</span>
                    ) : doc.expiryDate ? (
                      <span className="ml-1">· valid to {new Date(doc.expiryDate).toLocaleDateString()}</span>
                    ) : (
                      ""
                    )}
                    {doc.reviewNote ? ` · note: ${doc.reviewNote}` : ""}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {doc && (
                  <Button variant="ghost" onClick={() => download(doc.id, doc.fileName)}>
                    Download
                  </Button>
                )}
                {canReview && doc && doc.status === "PENDING" && (
                  <>
                    <Button variant="secondary" disabled={busyType === doc.id} onClick={() => review(doc.id, "APPROVED")}>
                      Approve
                    </Button>
                    <Button variant="danger" disabled={busyType === doc.id} onClick={() => review(doc.id, "REJECTED")}>
                      Reject
                    </Button>
                  </>
                )}
                {editable && (
                  <>
                    <input
                      ref={(el) => {
                        inputs.current[req.type] = el;
                      }}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => handleFile(req.type, e.target.files?.[0])}
                    />
                    <Button
                      variant={req.uploaded ? "secondary" : "primary"}
                      disabled={busyType === req.type}
                      onClick={() => inputs.current[req.type]?.click()}
                    >
                      {busyType === req.type ? "Uploading…" : req.uploaded ? "Replace" : "Upload"}
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-slate-400">Accepted: PDF, PNG, JPEG · max 1 MB each.</p>
    </div>
  );
}
