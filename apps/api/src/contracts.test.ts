import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("contract endpoints authorization", () => {
  it("rejects unauthenticated contract list", async () => {
    expect((await request(app).get("/api/contracts")).status).toBe(401);
  });
  it("rejects unauthenticated contract creation", async () => {
    expect((await request(app).post("/api/vendors/x/contracts").send({ title: "MSA" })).status).toBe(401);
  });
  it("rejects unauthenticated contract status change", async () => {
    expect((await request(app).post("/api/contracts/x/status").send({ status: "ACTIVE" })).status).toBe(401);
  });
  it("rejects unauthenticated obligation update", async () => {
    expect((await request(app).post("/api/contracts/obligations/x").send({ status: "MET" })).status).toBe(401);
  });
});
