import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import type { ReconciliationRowDTO, VendorLedgerDTO } from "@vendor-management/shared";
import type { InvoiceDocRow } from "../services/invoice-service.js";

// Buyer (the Vendrax procurement entity) — synthetic demo data.
const BUYER = {
  name: "Vendrax Motors Ltd",
  address: "Vendrax Tower, Hinjawadi Phase 2, Pune, Maharashtra 411057",
  gstin: "27AAECV1234A1Z5",
  stateCode: "27",
  plant: "Vendrax Plant 1, Chakan MIDC, Pune, Maharashtra 410501",
};

function inr(n: number): string {
  // Helvetica (pdfkit default) has no ₹ glyph, so use the "Rs." convention in PDFs.
  return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: Date | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
const dec = (d: { toNumber(): number } | null): number => (d ? d.toNumber() : 0);

/** Realistic Indian B2B automotive tax invoice as a PDF Buffer. */
export function buildInvoicePdf(inv: InvoiceDocRow): Promise<Buffer> {
  const oc = inv.vendor?.onboardingCase;
  const subtotal = dec(inv.subtotal);
  const tax = dec(inv.taxAmount);
  const total = dec(inv.totalAmount);
  const tds = dec(inv.tdsAmount);
  const netPayable = inv.netPayable ? dec(inv.netPayable) : total;
  const paid = dec(inv.amountPaid);
  const outstanding = Math.max(0, Math.round((netPayable - paid) * 100) / 100);
  const vendorState = (oc?.gstin ?? "").slice(0, 2);
  const intraState = vendorState === BUYER.stateCode;
  const lastPayment = inv.payments.length ? inv.payments[inv.payments.length - 1] : null;

  const qty = 500;
  const unitPrice = subtotal / qty;
  const partNo = `${inv.invoiceNumber.split("-")[0]}-PN-${inv.invoiceNumber.slice(-4)}`;

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const L = 40;
    const R = 555;
    // ---- Header: supplier ----
    doc.fontSize(16).font("Helvetica-Bold").text(inv.vendor?.legalName ?? "Vendor", L, 40);
    doc.fontSize(9).font("Helvetica").fillColor("#444");
    doc.text([oc?.addressLine1, oc?.city, oc?.state, oc?.postalCode].filter(Boolean).join(", ") || "—", L, 62, { width: 300 });
    doc.text(`GSTIN: ${oc?.gstin ?? "—"}    PAN: ${oc?.pan ?? "—"}`, L, doc.y + 2);
    doc.fillColor("#000");
    // Title
    doc.fontSize(15).font("Helvetica-Bold").fillColor("#c2410c").text("TAX INVOICE", 360, 40, { width: 195, align: "right" });
    doc.fillColor("#000").fontSize(9).font("Helvetica");
    const metaY = 66;
    const meta = [
      ["Invoice No", inv.invoiceNumber],
      ["Invoice Date", fmtDate(inv.invoiceDate)],
      ["PO No", inv.poNumber ?? "—"],
      ["PO Date", fmtDate(inv.invoiceDate ? new Date(inv.invoiceDate.getTime() - 7 * 86400000) : null)],
      ["Due Date", fmtDate(inv.dueDate)],
    ];
    meta.forEach(([k, v], i) => {
      doc.font("Helvetica").fillColor("#666").text(`${k}:`, 360, metaY + i * 13, { width: 90, align: "right" });
      doc.font("Helvetica-Bold").fillColor("#000").text(v, 455, metaY + i * 13, { width: 100, align: "right" });
    });

    doc.moveTo(L, 140).lineTo(R, 140).strokeColor("#ddd").stroke();

    // ---- Bill To / Ship To ----
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#666").text("BILL TO", L, 150);
    doc.font("Helvetica-Bold").fillColor("#000").fontSize(10).text(BUYER.name, L, 163);
    doc.font("Helvetica").fontSize(9).fillColor("#444").text(BUYER.address, L, 177, { width: 240 });
    doc.text(`GSTIN: ${BUYER.gstin}`, L, doc.y + 2);

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#666").text("SHIP TO", 320, 150);
    doc.font("Helvetica").fontSize(9).fillColor("#444").text(BUYER.plant, 320, 163, { width: 235 });

    // ---- Line items table ----
    let y = 235;
    const cols = { desc: L, part: 250, qty: 350, rate: 400, amt: 470 };
    doc.rect(L, y, R - L, 20).fill("#f1f5f9");
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(8);
    doc.text("DESCRIPTION", cols.desc + 4, y + 6);
    doc.text("PART NO", cols.part, y + 6);
    doc.text("QTY", cols.qty, y + 6, { width: 40, align: "right" });
    doc.text("RATE", cols.rate, y + 6, { width: 60, align: "right" });
    doc.text("AMOUNT", cols.amt, y + 6, { width: 80, align: "right" });
    y += 24;
    doc.fillColor("#000").font("Helvetica").fontSize(9);
    doc.text(inv.vendor?.displayName ? `${inv.vendor.displayName} — supply` : "Component supply", cols.desc + 4, y, { width: 200 });
    doc.text(partNo, cols.part, y);
    doc.text(String(qty), cols.qty, y, { width: 40, align: "right" });
    doc.text(inr(unitPrice), cols.rate, y, { width: 60, align: "right" });
    doc.text(inr(subtotal), cols.amt, y, { width: 80, align: "right" });
    y += 26;
    doc.moveTo(L, y).lineTo(R, y).strokeColor("#ddd").stroke();

    // ---- Totals ----
    y += 8;
    const totalsX = 350;
    const line = (label: string, value: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(bold ? "#000" : "#444");
      doc.text(label, totalsX, y, { width: 110, align: "right" });
      doc.text(value, 465, y, { width: 90, align: "right" });
      y += 15;
    };
    line("Taxable Value", inr(subtotal));
    if (intraState) {
      line(`CGST @ ${(dec(inv.gstRate) / 2).toFixed(1)}%`, inr(tax / 2));
      line(`SGST @ ${(dec(inv.gstRate) / 2).toFixed(1)}%`, inr(tax / 2));
    } else {
      line(`IGST @ ${dec(inv.gstRate).toFixed(1)}%`, inr(tax));
    }
    line("Grand Total", inr(total), true);
    if (tds > 0) line(`Less: TDS @ ${dec(inv.tdsRate).toFixed(1)}%`, "-" + inr(tds));
    line("Net Payable", inr(netPayable), true);

    // ---- Payment status box ----
    y += 12;
    doc.rect(L, y, R - L, 58).fillAndStroke("#f8fafc", "#e2e8f0");
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(9).text("PAYMENT DETAILS", L + 10, y + 8);
    doc.font("Helvetica").fontSize(9).fillColor("#000");
    const isPaid = inv.status === "PAID";
    doc.text(`Payment Terms: ${inv.dueDate ? "As per PO" : "Net 45"}`, L + 10, y + 24);
    doc.text(`Payment Status: ${inv.status}`, L + 10, y + 38);
    doc.font("Helvetica-Bold").fillColor(isPaid ? "#15803d" : "#b91c1c");
    doc.text(`Payment Date: ${isPaid && lastPayment ? fmtDate(lastPayment.paymentDate) : "Not paid"}`, 320, y + 24);
    doc.fillColor("#000").font("Helvetica").text(`Outstanding: ${inr(outstanding)}`, 320, y + 38);

    // ---- Footer ----
    doc.fontSize(8).fillColor("#94a3b8").font("Helvetica");
    doc.text("This is a computer-generated demo invoice for the Vendrax platform. Synthetic data — not a real tax document.", L, 770, { width: R - L, align: "center" });

    doc.end();
  });
}

export async function buildLedgerXlsx(ledger: VendorLedgerDTO, vendorName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vendrax";
  const ws = wb.addWorksheet("Ledger");
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `Vendor Ledger — ${vendorName}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow([`MSME: ${ledger.isMsme ? "Yes (45-day term)" : "No"}`, "", `Invoiced (net): ${ledger.totalInvoiced}`, `Paid: ${ledger.totalPaid}`, `Outstanding: ${ledger.outstanding}`]);
  const header = ws.addRow(["Date", "Reference", "Type", "Debit (₹)", "Credit (₹)", "Balance (₹)"]);
  header.font = { bold: true };
  header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }; });
  for (const e of ledger.entries) {
    ws.addRow([new Date(e.date).toLocaleDateString("en-IN"), e.reference, e.type, e.debit || "", e.credit || "", e.balance]);
  }
  [12, 20, 12, 16, 16, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildReconciliationXlsx(rows: ReconciliationRowDTO[], vendorName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vendrax";
  const ws = wb.addWorksheet("Reconciliation");
  ws.mergeCells("A1:M1");
  ws.getCell("A1").value = `Reconciliation — ${vendorName}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);
  const header = ws.addRow(["Invoice", "Date", "PO", "Invoice Amt", "PO Amt", "Paid", "Ledger", "Tax", "TDS", "Outstanding", "Match", "Exception", "Resolution"]);
  header.font = { bold: true };
  header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }; });
  for (const r of rows) {
    const row = ws.addRow([
      r.invoiceNumber, new Date(r.invoiceDate).toLocaleDateString("en-IN"), r.poNumber ?? "", r.invoiceAmount, r.poAmount ?? "",
      r.paidAmount, r.ledgerAmount, r.taxAmount, r.tds, r.outstanding, r.matchStatus ?? "", r.exceptionType ?? "", r.resolutionStatus,
    ]);
    if (r.resolutionStatus === "OPEN") row.getCell(12).font = { color: { argb: "FFB91C1C" }, bold: true };
  }
  [16, 12, 14, 14, 14, 14, 14, 12, 12, 14, 16, 20, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
