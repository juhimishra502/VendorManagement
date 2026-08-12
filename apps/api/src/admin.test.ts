import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("admin endpoints authorization", () => {
  it("rejects unauthenticated user list", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
  });
  it("rejects unauthenticated role change", async () => {
    expect((await request(app).post("/api/admin/users/x/role").send({ role: "ADMIN" })).status).toBe(401);
  });
  it("rejects unauthenticated alert sweep", async () => {
    expect((await request(app).post("/api/admin/run-alerts")).status).toBe(401);
  });
  it("rejects unauthenticated vendor export", async () => {
    expect((await request(app).get("/api/admin/export/vendors.csv")).status).toBe(401);
  });
  it("rejects unauthenticated invoice export", async () => {
    expect((await request(app).get("/api/admin/export/invoices.csv")).status).toBe(401);
  });
});
