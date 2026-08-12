import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("finance endpoints authorization", () => {
  it("rejects unauthenticated invoice list", async () => {
    expect((await request(app).get("/api/finance/invoices")).status).toBe(401);
  });
  it("rejects unauthenticated invoice summary", async () => {
    expect((await request(app).get("/api/finance/invoices/summary")).status).toBe(401);
  });
  it("rejects unauthenticated invoice status change", async () => {
    expect((await request(app).post("/api/finance/invoices/x/status").send({ status: "APPROVED" })).status).toBe(401);
  });
  it("rejects unauthenticated invoice recording", async () => {
    expect((await request(app).post("/api/vendors/x/invoices").send({ invoiceNumber: "INV-1" })).status).toBe(401);
  });
  it("rejects unauthenticated payment recording", async () => {
    expect((await request(app).post("/api/finance/invoices/x/payments").send({ amount: 1 })).status).toBe(401);
  });
  it("rejects unauthenticated finance control (exceptions/leakage)", async () => {
    expect((await request(app).get("/api/finance/control")).status).toBe(401);
  });
  it("rejects unauthenticated vendor ledger", async () => {
    expect((await request(app).get("/api/finance/vendors/x/ledger")).status).toBe(401);
  });
});
