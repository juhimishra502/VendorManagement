import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

// These tests assert API-level authorization is enforced server-side and does
// not depend on the browser. They require no database session.
describe("vendor API authorization", () => {
  it("rejects unauthenticated access to the procurement dashboard", async () => {
    const response = await request(app).get("/api/vendors");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects unauthenticated vendor creation", async () => {
    const response = await request(app).post("/api/vendors").send({ legalName: "Acme Industries" });
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated approval decisions", async () => {
    const response = await request(app)
      .post("/api/vendors/some-id/approvals/finance")
      .send({ decision: "APPROVED" });
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated ERP handoff retry", async () => {
    const response = await request(app).post("/api/vendors/some-id/erp-sync");
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated scorecard access", async () => {
    const response = await request(app).get("/api/vendors/some-id/scorecard");
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated performance review", async () => {
    const response = await request(app)
      .post("/api/vendors/some-id/performance-reviews")
      .send({ period: "2026-Q2", qualityScore: 80, deliveryScore: 80, costScore: 80, responsivenessScore: 80 });
    expect(response.status).toBe(401);
  });
});
