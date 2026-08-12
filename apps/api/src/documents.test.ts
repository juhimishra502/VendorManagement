import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

// Document endpoints must require authentication before any data access.
describe("document endpoints authorization", () => {
  it("rejects unauthenticated document listing", async () => {
    const response = await request(app).get("/api/vendors/some-id/documents");
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated document upload", async () => {
    const response = await request(app).post("/api/vendors/some-id/documents").send({ type: "PAN_CARD" });
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated document download", async () => {
    const response = await request(app).get("/api/documents/some-id/download");
    expect(response.status).toBe(401);
  });
});
