import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("invitation + onboarding endpoints", () => {
  it("rejects unauthenticated invitation send", async () => {
    const response = await request(app).post("/api/vendors/some-id/invitations");
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated draft save", async () => {
    const response = await request(app).post("/api/vendors/some-id/onboarding/draft").send({ city: "Pune" });
    expect(response.status).toBe(401);
  });

  it("accept is public but rejects an invalid token (404)", async () => {
    const response = await request(app)
      .post("/api/onboarding/accept")
      .send({ token: "definitely-not-a-real-token-aaaaaaaaaaaa" });
    expect(response.status).toBe(404);
  });

  it("accept validates the request body (400)", async () => {
    const response = await request(app).post("/api/onboarding/accept").send({});
    expect(response.status).toBe(400);
  });

  it("claim requires authentication (401)", async () => {
    const response = await request(app).post("/api/onboarding/claim").send({ token: "x".repeat(20) });
    expect(response.status).toBe(401);
  });
});
