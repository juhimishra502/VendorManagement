import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@vendor-management/db";
import { env } from "../config/env.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Trust the browser frontend origin so sign-in/up from the SPA is not
  // rejected by Better Auth's CSRF origin check.
  trustedOrigins: [env.CORS_ORIGIN, env.BETTER_AUTH_URL],
  emailAndPassword: { enabled: true },
});
