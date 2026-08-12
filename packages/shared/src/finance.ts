import { z } from "zod";

export const invoiceStatuses = ["RECEIVED", "MATCHED", "EXCEPTION", "APPROVED", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  RECEIVED: "Received",
  MATCHED: "Matched",
  EXCEPTION: "Exception",
  APPROVED: "Approved",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const matchStatuses = ["MATCHED", "PRICE_VARIANCE", "MISSING_PO", "MISSING_GRN", "DUPLICATE"] as const;
export type MatchStatus = (typeof matchStatuses)[number];

export const matchStatusLabels: Record<MatchStatus, string> = {
  MATCHED: "3-way matched",
  PRICE_VARIANCE: "Price variance",
  MISSING_PO: "Missing PO",
  MISSING_GRN: "Missing goods receipt",
  DUPLICATE: "Possible duplicate",
};

/** Reconciliation tolerance: 1% of the PO value or ₹1, whichever is larger. */
export function matchTolerance(poAmount: number): number {
  return Math.max(1, poAmount * 0.01);
}

export interface MatchResult {
  matchStatus: MatchStatus;
  variance: number;
  isException: boolean;
}

/**
 * Pure 3-way match on the entered PO / goods-receipt / invoice amounts.
 * Duplicate detection is layered on top by the service (needs a DB lookup).
 */
export function computeMatch(input: {
  poNumber?: string | null;
  poAmount?: number | null;
  grnNumber?: string | null;
  grnAmount?: number | null;
  totalAmount: number;
}): MatchResult {
  if (!input.poNumber || input.poAmount == null) {
    return { matchStatus: "MISSING_PO", variance: 0, isException: true };
  }
  if (!input.grnNumber || input.grnAmount == null) {
    return { matchStatus: "MISSING_GRN", variance: 0, isException: true };
  }
  const variance = Math.max(
    Math.abs(input.totalAmount - input.poAmount),
    Math.abs(input.totalAmount - input.grnAmount),
    Math.abs(input.poAmount - input.grnAmount),
  );
  if (variance > matchTolerance(input.poAmount)) {
    return { matchStatus: "PRICE_VARIANCE", variance: Math.round(variance * 100) / 100, isException: true };
  }
  return { matchStatus: "MATCHED", variance: 0, isException: false };
}

const money = z.number().nonnegative().finite();
const optionalMoney = money.optional();
const rate = z.number().min(0).max(100);

/** Statutory MSMED Act payment term for MSME suppliers (India): 45 days. */
export const msmedTermDays = 45;
/** Default net payment term for non-MSME suppliers when no due date is given. */
export const defaultTermDays = 30;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTds(subtotal: number, tdsRate: number): number {
  return round2((subtotal * tdsRate) / 100);
}

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(60),
  invoiceDate: z.string().min(4), // ISO date
  dueDate: z.string().min(4).optional(),
  currency: z.string().trim().length(3).default("INR"),
  subtotal: money,
  taxAmount: money.default(0),
  totalAmount: money,
  gstRate: rate.optional(),
  tdsRate: rate.optional(),
  poNumber: z.string().trim().max(60).optional(),
  poAmount: optionalMoney,
  grnNumber: z.string().trim().max(60).optional(),
  grnAmount: optionalMoney,
  note: z.string().trim().max(1000).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const recordPaymentSchema = z.object({
  amount: z.number().positive().finite(),
  paymentDate: z.string().min(4),
  method: z.string().trim().min(2).max(40),
  reference: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export interface InvoiceDTO {
  id: string;
  vendorId: string;
  vendorName: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  poNumber: string | null;
  poAmount: number | null;
  grnNumber: string | null;
  grnAmount: number | null;
  matchStatus: MatchStatus | null;
  varianceAmount: number | null;
  note: string | null;
  // Tax + settlement
  gstRate: number | null;
  tdsRate: number | null;
  tdsAmount: number | null;
  netPayable: number;
  amountPaid: number;
  outstanding: number;
  // MSMED
  isMsme: boolean;
  effectiveDueDate: string | null;
  overdue: boolean;
  createdByName: string | null;
  createdAt: string;
}

export interface InvoiceSummaryDTO {
  total: number;
  matched: number;
  exceptions: number;
  totalValue: number;
  exceptionValue: number;
}

export interface PaymentDTO {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  amount: number;
  paymentDate: string;
  method: string;
  reference: string | null;
  note: string | null;
  recordedByName: string | null;
  createdAt: string;
}

export interface LedgerEntryDTO {
  date: string;
  type: "INVOICE" | "PAYMENT";
  reference: string;
  debit: number; // amount payable to vendor (invoice net)
  credit: number; // amount paid
  balance: number; // running outstanding
}

export interface VendorLedgerDTO {
  vendorId: string;
  isMsme: boolean;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  overdueValue: number;
  entries: LedgerEntryDTO[];
  payments: PaymentDTO[];
}

// ---------------------------------------------------------------------------
// Finance exceptions + cash leakage (Phase 10) — all DERIVED, finance-only.
// ---------------------------------------------------------------------------

export const financeExceptionTypes = [
  "RECONCILIATION",
  "DUPLICATE",
  "OVERDUE",
  "MSMED_BREACH",
  "TAX_ANOMALY",
] as const;
export type FinanceExceptionType = (typeof financeExceptionTypes)[number];

export const financeExceptionLabels: Record<FinanceExceptionType, string> = {
  RECONCILIATION: "Reconciliation mismatch",
  DUPLICATE: "Possible duplicate",
  OVERDUE: "Overdue payment",
  MSMED_BREACH: "MSMED 45-day breach",
  TAX_ANOMALY: "Tax anomaly",
};

export type ExceptionSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface FinanceExceptionDTO {
  id: string;
  type: FinanceExceptionType;
  severity: ExceptionSeverity;
  vendorId: string;
  vendorName: string | null;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  detail: string;
  date: string;
}

export interface CashLeakageDTO {
  total: number;
  duplicateValue: number;
  overbillingValue: number;
  msmedExposure: number;
}

export interface FinanceControlDTO {
  exceptions: FinanceExceptionDTO[];
  leakage: CashLeakageDTO;
}

export interface ReconciliationRowDTO {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  poNumber: string | null;
  invoiceAmount: number;
  poAmount: number | null;
  paidAmount: number;
  ledgerAmount: number;
  taxAmount: number;
  tds: number;
  outstanding: number;
  matchStatus: MatchStatus | null;
  exceptionType: string | null;
  variance: number;
  resolutionStatus: "MATCHED" | "OPEN" | "RESOLVED";
}
