import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("notification & reminder endpoints authorization", () => {
  it("rejects unauthenticated notification list", async () => {
    expect((await request(app).get("/api/notifications")).status).toBe(401);
  });
  it("rejects unauthenticated unread-count", async () => {
    expect((await request(app).get("/api/notifications/unread-count")).status).toBe(401);
  });
  it("rejects unauthenticated mark-read", async () => {
    expect((await request(app).post("/api/notifications/abc/read")).status).toBe(401);
  });
  it("rejects unauthenticated mark-all-read", async () => {
    expect((await request(app).post("/api/notifications/read-all")).status).toBe(401);
  });
  it("rejects unauthenticated reminder", async () => {
    expect((await request(app).post("/api/vendors/x/remind").send({ target: "VENDOR" })).status).toBe(401);
  });
});
