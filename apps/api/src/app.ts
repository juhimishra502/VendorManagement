import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env.js";
import { auth } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { vendorsRouter } from "./routes/vendors.js";
import { documentsRouter } from "./routes/documents.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { requestsRouter } from "./routes/requests.js";
import { opsRouter } from "./routes/operations.js";
import { notificationsRouter } from "./routes/notifications.js";
import { financeRouter } from "./routes/finance.js";
import { contractsRouter } from "./routes/contracts.js";
import { adminRouter } from "./routes/admin.js";
import { devRouter } from "./routes/dev.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "2mb" }));
app.use("/api", healthRouter);
app.use("/api/me", meRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/finance", financeRouter);
app.use("/api/contracts", contractsRouter);
app.use("/api/admin", adminRouter);
app.use("/api", opsRouter);

// Development-only helpers (role assignment). Never mounted in production.
if (env.NODE_ENV !== "production") {
  app.use("/api/dev", devRouter);
}

app.all("/api/*splat", (_request, response) => {
  response.status(404).json({ success: false, error: "API route not found" });
});

if (env.NODE_ENV === "production") {
  const frontendDist = path.resolve(process.cwd(), "apps/api/frontend");
  app.use(express.static(frontendDist));
  app.get("/*splat", (_request, response) => {
    response.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(errorHandler);
