import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),
});

const testDefaults = process.env.NODE_ENV === "test"
  ? { DATABASE_URL: "postgresql://localhost/test", BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long" }
  : {};

// On Render the public https URL is injected as RENDER_EXTERNAL_URL. Use it as
// the default auth/CORS origin so a Render deploy only needs the DB + secret set
// (explicit BETTER_AUTH_URL / CORS_ORIGIN still win if provided).
const renderUrl = process.env.RENDER_EXTERNAL_URL;
const renderDefaults = renderUrl ? { BETTER_AUTH_URL: renderUrl, CORS_ORIGIN: renderUrl } : {};

const environment = {
  ...testDefaults,
  ...renderDefaults,
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL?.replace(/^["']|["']$/g, ""),
};

export const env = envSchema.parse(environment);
