import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

// Control-tower / approver-workspace endpoints require authentication.
describe("operations endpoints authorization", () => {
  it("rejects unauthenticated metrics", async () => {
    expect((await request(app).get("/api/metrics")).status).toBe(401);
  });
  it("rejects unauthenticated approval queue", async () => {
    expect((await request(app).get("/api/approvals")).status).toBe(401);
  });
  it("rejects unauthenticated activity feed", async () => {
    expect((await request(app).get("/api/activity")).status).toBe(401);
  });
});
