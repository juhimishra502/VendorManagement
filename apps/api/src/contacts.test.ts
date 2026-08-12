import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("vendor contact endpoints", () => {
  it("rejects unauthenticated contact upsert", async () => {
    expect((await request(app).post("/api/vendors/x/contacts").send({ type: "PRIMARY", name: "A" })).status).toBe(401);
  });
  it("rejects unauthenticated contact delete", async () => {
    expect((await request(app).delete("/api/vendors/x/contacts/y")).status).toBe(401);
  });
});
