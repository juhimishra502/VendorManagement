import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

// The dev router requires authentication before anything else.
describe("dev-only role endpoints", () => {
  it("rejects unauthenticated access to /api/dev/users", async () => {
    const response = await request(app).get("/api/dev/users");
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated role assignment", async () => {
    const response = await request(app)
      .post("/api/dev/assign-role")
      .send({ userId: "x", role: "FINANCE" });
    expect(response.status).toBe(401);
  });
});
