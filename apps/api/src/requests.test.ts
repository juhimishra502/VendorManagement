import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("business request endpoints", () => {
  it("rejects unauthenticated listing", async () => {
    expect((await request(app).get("/api/requests")).status).toBe(401);
  });
  it("rejects unauthenticated creation", async () => {
    expect((await request(app).post("/api/requests").send({ vendorName: "Acme Auto" })).status).toBe(401);
  });
  it("rejects unauthenticated convert", async () => {
    expect((await request(app).post("/api/requests/x/convert").send({})).status).toBe(401);
  });
});
