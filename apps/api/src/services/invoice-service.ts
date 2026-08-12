import { prisma, Prisma } from "@vendor-management/db";
import {
  computeMatch,
  computeTds,
  defaultTermDays,
  matchStatusLabels,
  msmedTermDays,
  round2,
  type CashLeakageDTO,
  type CreateInvoiceInput,
  type FinanceControlDTO,
  type FinanceExceptionDTO,
  type InvoiceDTO,
  type InvoiceStatus,
  type InvoiceSummaryDTO,
  type MatchStatus,
  type PaymentDTO,
  type RecordPaymentInput,
  type ReconciliationRowDTO,
  type UserRole,
  type VendorLedgerDTO,
  type LedgerEntryDTO,
} from "@vendor-management/shared";
import type { AuthContext } from "../middleware/auth.js";
import { ServiceError } from "./vendor-service.js";
import { notifyRole, safeNotify } from "./notification-service.js";

const INTERNAL_ROLES: UserRole[] = ["ADMIN", "PROCUREMENT", "FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"];
const FINANCE_ROLES: UserRole[] = ["ADMIN", "FINANCE"];

function assertInternal(auth: AuthContext): void {
  if (!INTERNAL_ROLES.includes(auth.role)) throw new ServiceError(403, "This resource is only available to internal users");
}
function assertFinance(auth: AuthContext): void {
  if (!FINANCE_ROLES.includes(auth.role)) throw new ServiceError(403, "Only finance or admin can manage invoices");
}

const num = (d: Prisma.Decimal | null): number | null => (d == null ? null : d.toNumber());

const invoiceInclude = {
  vendor: { select: { legalName: true, onboardingCase: { select: { udyam: true } } } },
  createdBy: { select: { name: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

function isMsmeVendor(inv: InvoiceRow): boolean {
  return !!inv.vendor?.onboardingCase?.udyam?.trim();
}

/** Effective payment due date: MSME → invoice + 45d (statutory); else due date or +30d. */
function effectiveDueDate(inv: InvoiceRow, isMsme: boolean): Date {
  if (isMsme) return new Date(inv.invoiceDate.getTime() + msmedTermDays * 86_400_000);
  if (inv.dueDate) return inv.dueDate;
  return new Date(inv.invoiceDate.getTime() + defaultTermDays * 86_400_000);
}

export function toInvoiceDTO(inv: InvoiceRow): InvoiceDTO {
  const isMsme = isMsmeVendor(inv);
  const netPayable = inv.netPayable?.toNumber() ?? inv.totalAmount.toNumber();
  const amountPaid = inv.amountPaid.toNumber();
  const outstanding = round2(netPayable - amountPaid);
  const due = effectiveDueDate(inv, isMsme);
  const settled = inv.status === "PAID" || inv.status === "CANCELLED";
  return {
    id: inv.id,
    vendorId: inv.vendorId,
    vendorName: inv.vendor?.legalName ?? null,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    currency: inv.currency,
    subtotal: inv.subtotal.toNumber(),
    taxAmount: inv.taxAmount.toNumber(),
    totalAmount: inv.totalAmount.toNumber(),
    status: inv.status,
    poNumber: inv.poNumber,
    poAmount: num(inv.poAmount),
    grnNumber: inv.grnNumber,
    grnAmount: num(inv.grnAmount),
    matchStatus: inv.matchStatus,
    varianceAmount: num(inv.varianceAmount),
    note: inv.note,
    gstRate: num(inv.gstRate),
    tdsRate: num(inv.tdsRate),
    tdsAmount: num(inv.tdsAmount),
    netPayable,
    amountPaid,
    outstanding,
    isMsme,
    effectiveDueDate: due.toISOString(),
    overdue: !settled && outstanding > 0.005 && due.getTime() < Date.now(),
    createdByName: inv.createdBy?.name ?? null,
    createdAt: inv.createdAt.toISOString(),
  };
}

/** Record an invoice and run the 3-way reconciliation (finance/admin). */
export async function createInvoice(vendorId: string, input: CreateInvoiceInput, actor: AuthContext): Promise<InvoiceDTO> {
  assertFinance(actor);
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) throw new ServiceError(404, "Vendor not found");

  const exists = await prisma.invoice.findUnique({
    where: { vendorId_invoiceNumber: { vendorId, invoiceNumber: input.invoiceNumber } },
    select: { id: true },
  });
  if (exists) throw new ServiceError(409, `Invoice ${input.invoiceNumber} already exists for this vendor`);

  let match = computeMatch(input);

  // Duplicate heuristic: same PO reused, or identical amount + date on another invoice.
  const orConds: Prisma.InvoiceWhereInput[] = [];
  if (input.poNumber) orConds.push({ poNumber: input.poNumber });
  orConds.push({ totalAmount: input.totalAmount, invoiceDate: new Date(input.invoiceDate) });
  const dup = await prisma.invoice.findFirst({ where: { vendorId, OR: orConds }, select: { id: true } });
  if (dup) match = { matchStatus: "DUPLICATE" as MatchStatus, variance: 0, isException: true };

  const status: InvoiceStatus = match.isException ? "EXCEPTION" : "MATCHED";

  // TDS is withheld from the vendor's net payable; GST rate is informational.
  const tdsAmount = input.tdsRate != null ? computeTds(input.subtotal, input.tdsRate) : null;
  const netPayable = round2(input.totalAmount - (tdsAmount ?? 0));

  const created = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        vendorId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: new Date(input.invoiceDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        currency: input.currency,
        subtotal: input.subtotal,
        taxAmount: input.taxAmount,
        totalAmount: input.totalAmount,
        status,
        poNumber: input.poNumber ?? null,
        poAmount: input.poAmount ?? null,
        grnNumber: input.grnNumber ?? null,
        grnAmount: input.grnAmount ?? null,
        matchStatus: match.matchStatus,
        varianceAmount: match.variance || null,
        note: input.note ?? null,
        gstRate: input.gstRate ?? null,
        tdsRate: input.tdsRate ?? null,
        tdsAmount,
        netPayable,
        createdById: actor.userId,
      },
      include: invoiceInclude,
    });
    await tx.auditLog.create({
      data: {
        vendorId,
        actorId: actor.userId,
        action: "INVOICE_RECORDED",
        detail: { invoiceNumber: input.invoiceNumber, matchStatus: match.matchStatus, status, by: actor.email },
      },
    });
    return inv;
  });

  // Alert finance when reconciliation flags an exception.
  if (match.isException) {
    await safeNotify(() =>
      notifyRole("FINANCE", {
        type: "FINANCE_EXCEPTION",
        title: `Invoice exception: ${input.invoiceNumber}`,
        body: `${matchStatusLabels[match.matchStatus]} on ${created.vendor?.legalName ?? "vendor"}.`,
        vendorId,
        relatedType: "invoice",
        relatedId: created.id,
      }),
    );
  }

  return toInvoiceDTO(created);
}

/** Finance approves a matched invoice (or cancels one). */
export async function setInvoiceStatus(
  invoiceId: string,
  status: Extract<InvoiceStatus, "APPROVED" | "CANCELLED">,
  actor: AuthContext,
): Promise<InvoiceDTO> {
  assertFinance(actor);
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, status: true, vendorId: true } });
  if (!inv) throw new ServiceError(404, "Invoice not found");
  if (status === "APPROVED" && inv.status !== "MATCHED") {
    throw new ServiceError(409, "Only a matched invoice can be approved");
  }
  if (inv.status === "PAID") throw new ServiceError(409, "A paid invoice cannot change status");

  const updated = await prisma.invoice.update({ where: { id: invoiceId }, data: { status }, include: invoiceInclude });
  await prisma.auditLog.create({
    data: { vendorId: inv.vendorId, actorId: actor.userId, action: `INVOICE_${status}`, detail: { invoiceId, by: actor.email } },
  });
  return toInvoiceDTO(updated);
}

export async function listInvoices(actor: AuthContext, vendorId?: string): Promise<InvoiceDTO[]> {
  assertInternal(actor);
  const rows = await prisma.invoice.findMany({
    where: vendorId ? { vendorId } : {},
    orderBy: { invoiceDate: "desc" },
    include: invoiceInclude,
  });
  return rows.map(toInvoiceDTO);
}

/**
 * Record a payment against an invoice. This is a BOOKKEEPING entry for a payment
 * already made in the bank/ERP — it never initiates a transfer. Finance/admin only.
 */
export async function recordPayment(
  invoiceId: string,
  input: RecordPaymentInput,
  actor: AuthContext,
): Promise<InvoiceDTO> {
  assertFinance(actor);
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, vendorId: true, status: true, netPayable: true, totalAmount: true, amountPaid: true },
  });
  if (!inv) throw new ServiceError(404, "Invoice not found");
  if (inv.status === "CANCELLED") throw new ServiceError(409, "Cannot pay a cancelled invoice");
  if (inv.status === "EXCEPTION") throw new ServiceError(409, "Resolve the invoice exception before recording payment");

  const netPayable = inv.netPayable?.toNumber() ?? inv.totalAmount.toNumber();
  const alreadyPaid = inv.amountPaid.toNumber();
  const outstanding = round2(netPayable - alreadyPaid);
  if (input.amount > outstanding + 0.005) {
    throw new ServiceError(409, `Payment exceeds the outstanding balance (${outstanding})`);
  }

  const newPaid = round2(alreadyPaid + input.amount);
  const fullySettled = newPaid >= netPayable - 0.005;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId,
        vendorId: inv.vendorId,
        amount: input.amount,
        paymentDate: new Date(input.paymentDate),
        method: input.method,
        reference: input.reference ?? null,
        note: input.note ?? null,
        recordedById: actor.userId,
      },
    });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: newPaid, status: fullySettled ? "PAID" : undefined },
    });
    await tx.auditLog.create({
      data: {
        vendorId: inv.vendorId,
        actorId: actor.userId,
        action: "PAYMENT_RECORDED",
        detail: { invoiceId, amount: input.amount, method: input.method, fullySettled, by: actor.email },
      },
    });
  });

  const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: invoiceInclude });
  return toInvoiceDTO(updated);
}

/** Derived vendor ledger: invoices (payable) vs payments, running outstanding. */
export async function getVendorLedger(vendorId: string, actor: AuthContext): Promise<VendorLedgerDTO> {
  assertInternal(actor);
  const [vendor, invoices, payments] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { onboardingCase: { select: { udyam: true } } } }),
    prisma.invoice.findMany({ where: { vendorId, status: { not: "CANCELLED" } }, include: invoiceInclude, orderBy: { invoiceDate: "asc" } }),
    prisma.payment.findMany({
      where: { vendorId },
      orderBy: { paymentDate: "asc" },
      include: { invoice: { select: { invoiceNumber: true } }, recordedBy: { select: { name: true } } },
    }),
  ]);
  if (!vendor) throw new ServiceError(404, "Vendor not found");
  const isMsme = !!vendor.onboardingCase?.udyam?.trim();

  // Interleave invoices (debit = net payable) and payments (credit) by date.
  type Row = { date: Date; type: "INVOICE" | "PAYMENT"; reference: string; debit: number; credit: number };
  const rows: Row[] = [
    ...invoices.map((i) => ({
      date: i.invoiceDate,
      type: "INVOICE" as const,
      reference: i.invoiceNumber,
      debit: i.netPayable?.toNumber() ?? i.totalAmount.toNumber(),
      credit: 0,
    })),
    ...payments.map((p) => ({
      date: p.paymentDate,
      type: "PAYMENT" as const,
      reference: p.reference ?? p.invoice?.invoiceNumber ?? "payment",
      debit: 0,
      credit: p.amount.toNumber(),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  const entries: LedgerEntryDTO[] = rows.map((r) => {
    balance = round2(balance + r.debit - r.credit);
    return { date: r.date.toISOString(), type: r.type, reference: r.reference, debit: r.debit, credit: r.credit, balance };
  });

  const totalInvoiced = round2(invoices.reduce((s, i) => s + (i.netPayable?.toNumber() ?? i.totalAmount.toNumber()), 0));
  const totalPaid = round2(payments.reduce((s, p) => s + p.amount.toNumber(), 0));
  const invoiceDTOs = invoices.map(toInvoiceDTO);
  const overdueValue = round2(invoiceDTOs.filter((i) => i.overdue).reduce((s, i) => s + i.outstanding, 0));

  return {
    vendorId,
    isMsme,
    totalInvoiced,
    totalPaid,
    outstanding: round2(totalInvoiced - totalPaid),
    overdueValue,
    entries,
    payments: payments.map(
      (p): PaymentDTO => ({
        id: p.id,
        invoiceId: p.invoiceId,
        invoiceNumber: p.invoice?.invoiceNumber ?? null,
        amount: p.amount.toNumber(),
        paymentDate: p.paymentDate.toISOString(),
        method: p.method,
        reference: p.reference,
        note: p.note,
        recordedByName: p.recordedBy?.name ?? null,
        createdAt: p.createdAt.toISOString(),
      }),
    ),
  };
}

/**
 * Finance exceptions + cash-leakage estimate, all DERIVED from invoice data.
 * Finance/admin only — this is internal risk information, never shown to vendors.
 */
export async function getFinanceControl(actor: AuthContext): Promise<FinanceControlDTO> {
  assertFinance(actor);
  const rows = await prisma.invoice.findMany({ where: { status: { not: "CANCELLED" } }, include: invoiceInclude });
  const invoices = rows.map(toInvoiceDTO);

  const exceptions: FinanceExceptionDTO[] = [];
  let duplicateValue = 0;
  let overbillingValue = 0;
  let msmedExposure = 0;

  for (const inv of invoices) {
    const base = {
      vendorId: inv.vendorId,
      vendorName: inv.vendorName,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.invoiceDate,
    };

    if (inv.matchStatus === "DUPLICATE") {
      duplicateValue = round2(duplicateValue + inv.totalAmount);
      exceptions.push({ ...base, id: `${inv.id}:DUPLICATE`, type: "DUPLICATE", severity: "HIGH", amount: inv.totalAmount, detail: "Reused PO or identical amount + date — double-payment risk." });
    } else if (inv.matchStatus === "PRICE_VARIANCE" || inv.matchStatus === "MISSING_PO" || inv.matchStatus === "MISSING_GRN") {
      if (inv.matchStatus === "PRICE_VARIANCE" && inv.poAmount != null && inv.totalAmount > inv.poAmount) {
        overbillingValue = round2(overbillingValue + (inv.totalAmount - inv.poAmount));
      }
      exceptions.push({ ...base, id: `${inv.id}:RECON`, type: "RECONCILIATION", severity: "MEDIUM", amount: inv.varianceAmount ?? inv.totalAmount, detail: inv.matchStatus === "PRICE_VARIANCE" ? "Invoice, PO and goods-receipt amounts disagree." : "PO or goods receipt not linked." });
    }

    if (inv.overdue) {
      if (inv.isMsme) {
        msmedExposure = round2(msmedExposure + inv.outstanding);
        exceptions.push({ ...base, id: `${inv.id}:MSMED`, type: "MSMED_BREACH", severity: "HIGH", amount: inv.outstanding, detail: "MSME supplier unpaid beyond the statutory 45-day term — interest exposure." });
      } else {
        exceptions.push({ ...base, id: `${inv.id}:OVERDUE`, type: "OVERDUE", severity: "MEDIUM", amount: inv.outstanding, detail: "Payment overdue past its due date." });
      }
    }

    if (Math.abs(inv.subtotal + inv.taxAmount - inv.totalAmount) > 1) {
      exceptions.push({ ...base, id: `${inv.id}:TAX`, type: "TAX_ANOMALY", severity: "LOW", amount: inv.totalAmount, detail: "Total does not equal subtotal + tax." });
    }
  }

  const severityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  exceptions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.amount - a.amount);

  const leakage: CashLeakageDTO = {
    total: round2(duplicateValue + overbillingValue + msmedExposure),
    duplicateValue,
    overbillingValue,
    msmedExposure,
  };
  return { exceptions, leakage };
}

// Rich invoice load for the downloadable PDF (full vendor + payments).
const invoiceDocInclude = {
  vendor: {
    select: {
      legalName: true,
      displayName: true,
      onboardingCase: {
        select: {
          udyam: true, gstin: true, pan: true, addressLine1: true, city: true, state: true,
          postalCode: true, contactName: true, contactPhone: true, bankName: true, bankAccountNumber: true, bankIfsc: true,
        },
      },
    },
  },
  createdBy: { select: { name: true } },
  payments: { orderBy: { paymentDate: "asc" as const } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceDocRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceDocInclude }>;

export async function getInvoiceDetail(id: string, actor: AuthContext): Promise<InvoiceDTO> {
  assertInternal(actor);
  const inv = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!inv) throw new ServiceError(404, "Invoice not found");
  return toInvoiceDTO(inv);
}

export async function loadInvoiceForDoc(id: string, actor: AuthContext): Promise<InvoiceDocRow> {
  assertInternal(actor);
  const inv = await prisma.invoice.findUnique({ where: { id }, include: invoiceDocInclude });
  if (!inv) throw new ServiceError(404, "Invoice not found");
  return inv;
}

/** Derived reconciliation rows for a vendor (3-way match view + exceptions). */
export async function getVendorReconciliation(vendorId: string, actor: AuthContext): Promise<ReconciliationRowDTO[]> {
  assertInternal(actor);
  const rows = await prisma.invoice.findMany({
    where: { vendorId, status: { not: "CANCELLED" } },
    orderBy: { invoiceDate: "asc" },
    include: invoiceInclude,
  });
  return rows.map((inv) => {
    const dto = toInvoiceDTO(inv);
    const exceptionType =
      dto.matchStatus === "MATCHED" ? null : dto.matchStatus ? matchStatusLabels[dto.matchStatus] : null;
    return {
      invoiceId: dto.id,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate: dto.invoiceDate,
      poNumber: dto.poNumber,
      invoiceAmount: dto.totalAmount,
      poAmount: dto.poAmount,
      paidAmount: dto.amountPaid,
      ledgerAmount: dto.amountPaid,
      taxAmount: dto.taxAmount,
      tds: dto.tdsAmount ?? 0,
      outstanding: dto.outstanding,
      matchStatus: dto.matchStatus,
      exceptionType,
      variance: dto.varianceAmount ?? 0,
      resolutionStatus: dto.matchStatus === "MATCHED" ? "MATCHED" : dto.status === "PAID" ? "RESOLVED" : "OPEN",
    };
  });
}

export async function getInvoiceSummary(actor: AuthContext): Promise<InvoiceSummaryDTO> {
  assertInternal(actor);
  const [total, matched, exceptions, totalAgg, exceptionAgg] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: "MATCHED" } }),
    prisma.invoice.count({ where: { status: "EXCEPTION" } }),
    prisma.invoice.aggregate({ _sum: { totalAmount: true } }),
    prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { status: "EXCEPTION" } }),
  ]);
  return {
    total,
    matched,
    exceptions,
    totalValue: totalAgg._sum.totalAmount?.toNumber() ?? 0,
    exceptionValue: exceptionAgg._sum.totalAmount?.toNumber() ?? 0,
  };
}
