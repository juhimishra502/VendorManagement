import type {
  CreateInvoiceInput,
  FinanceControlDTO,
  InvoiceDTO,
  InvoiceSummaryDTO,
  ReconciliationRowDTO,
  RecordPaymentInput,
  VendorLedgerDTO,
} from "@vendor-management/shared";
import { apiFetch, downloadFile } from "./http.js";

export function getFinanceControl(): Promise<FinanceControlDTO> {
  return apiFetch<FinanceControlDTO>("/api/finance/control");
}

export function listAllInvoices(): Promise<InvoiceDTO[]> {
  return apiFetch<InvoiceDTO[]>("/api/finance/invoices");
}

export function getInvoiceSummary(): Promise<InvoiceSummaryDTO> {
  return apiFetch<InvoiceSummaryDTO>("/api/finance/invoices/summary");
}

export function listVendorInvoices(vendorId: string): Promise<InvoiceDTO[]> {
  return apiFetch<InvoiceDTO[]>(`/api/vendors/${vendorId}/invoices`);
}

export function createInvoice(vendorId: string, input: CreateInvoiceInput): Promise<InvoiceDTO> {
  return apiFetch<InvoiceDTO>(`/api/vendors/${vendorId}/invoices`, { method: "POST", body: JSON.stringify(input) });
}

export function setInvoiceStatus(invoiceId: string, status: "APPROVED" | "CANCELLED"): Promise<InvoiceDTO> {
  return apiFetch<InvoiceDTO>(`/api/finance/invoices/${invoiceId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function recordPayment(invoiceId: string, input: RecordPaymentInput): Promise<InvoiceDTO> {
  return apiFetch<InvoiceDTO>(`/api/finance/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getVendorLedger(vendorId: string): Promise<VendorLedgerDTO> {
  return apiFetch<VendorLedgerDTO>(`/api/finance/vendors/${vendorId}/ledger`);
}

export function getInvoiceDetail(invoiceId: string): Promise<InvoiceDTO> {
  return apiFetch<InvoiceDTO>(`/api/finance/invoices/${invoiceId}`);
}

export function getVendorReconciliation(vendorId: string): Promise<ReconciliationRowDTO[]> {
  return apiFetch<ReconciliationRowDTO[]>(`/api/finance/vendors/${vendorId}/reconciliation`);
}

// Downloads (stream a file with the session cookie and trigger a browser save).
export function downloadInvoicePdf(invoiceId: string, invoiceNumber: string): Promise<void> {
  return downloadFile(`/api/finance/invoices/${invoiceId}/pdf`, `${invoiceNumber}.pdf`);
}
export function downloadLedgerXlsx(vendorId: string, vendorName: string): Promise<void> {
  return downloadFile(`/api/finance/vendors/${vendorId}/ledger.xlsx`, `ledger-${vendorName}.xlsx`);
}
export function downloadReconciliationXlsx(vendorId: string, vendorName: string): Promise<void> {
  return downloadFile(`/api/finance/vendors/${vendorId}/reconciliation.xlsx`, `reconciliation-${vendorName}.xlsx`);
}
