import crypto from "node:crypto";
import { prisma } from "@vendor-management/db";
import type { AuthContext } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { emailProvider } from "../providers/email.js";
import { ServiceError } from "./vendor-service.js";

const INVITE_TTL_DAYS = 7;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** A cryptographically secure, non-guessable, URL-safe token. Only its hash is stored. */
function newToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

/**
 * Procurement sends (or resends) an onboarding invitation. Any previously active
 * invitation is revoked so only the newest link works. Existing onboarding
 * progress is preserved. Returns the raw token once (never stored).
 */
export async function sendInvitation(
  vendorId: string,
  actor: AuthContext,
): Promise<{ token: string; expiresAt: Date; email: string }> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, contactEmail: true, legalName: true },
  });
  if (!vendor) throw new ServiceError(404, "Vendor not found");
  if (!vendor.contactEmail) throw new ServiceError(409, "Vendor has no contact email to invite");

  const { token, tokenHash } = newToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

  await prisma.$transaction(
    async (tx) => {
      await tx.vendorInvitation.updateMany({
        where: { vendorId, status: { in: ["SENT", "OPENED"] } },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      await tx.vendorInvitation.create({
        data: { vendorId, tokenHash, email: vendor.contactEmail!, expiresAt, sentById: actor.userId },
      });
      await tx.auditLog.create({
        data: {
          vendorId,
          actorId: actor.userId,
          action: "INVITATION_SENT",
          detail: { email: vendor.contactEmail, expiresAt: expiresAt.toISOString(), by: actor.email },
        },
      });
    },
    { timeout: 30000, maxWait: 15000 },
  );

  // Deliver the link (mock provider logs it; swap for a real provider to send).
  const link = `${env.CORS_ORIGIN}/onboard/${token}`;
  await emailProvider
    .sendInvitation({ to: vendor.contactEmail, vendorName: vendor.legalName, link, expiresAt })
    .catch(() => {
      /* delivery failure must not break invitation creation; procurement can still copy the link */
    });

  return { token, expiresAt, email: vendor.contactEmail };
}

/**
 * Public: validate a token (possession = authorization to open), mark OPENED,
 * and move onboarding to IN_PROGRESS if it has not already started.
 */
export async function acceptInvitation(token: string): Promise<{ vendorId: string; email: string }> {
  const inv = await prisma.vendorInvitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { vendor: { include: { onboardingCase: true } } },
  });
  if (!inv) throw new ServiceError(404, "This onboarding link is not valid");
  if (inv.status === "REVOKED") throw new ServiceError(410, "This onboarding link has been replaced by a newer invitation");
  if (inv.expiresAt.getTime() < Date.now()) {
    if (inv.status !== "EXPIRED") {
      await prisma.vendorInvitation.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
    }
    throw new ServiceError(410, "This onboarding link has expired");
  }

  await prisma.$transaction(
    async (tx) => {
      if (inv.status === "SENT") {
        await tx.vendorInvitation.update({ where: { id: inv.id }, data: { status: "OPENED", openedAt: new Date() } });
        await tx.auditLog.create({
          data: { vendorId: inv.vendorId, action: "INVITATION_OPENED", detail: { email: inv.email } },
        });
      }
      const oc = inv.vendor.onboardingCase;
      if (oc && oc.status === "CREATED") {
        await tx.onboardingCase.update({ where: { id: oc.id }, data: { status: "IN_PROGRESS" } });
        await tx.auditLog.create({
          data: { vendorId: inv.vendorId, onboardingCaseId: oc.id, action: "ONBOARDING_STARTED", detail: {} },
        });
      }
    },
    { timeout: 30000, maxWait: 15000 },
  );

  return { vendorId: inv.vendorId, email: inv.email };
}

/**
 * Authenticated: bind the signed-in user (whose email must match the invitation)
 * to the vendor by granting the VENDOR role. Never downgrades an internal role.
 */
export async function claimInvitation(token: string, actor: AuthContext): Promise<{ vendorId: string }> {
  const inv = await prisma.vendorInvitation.findUnique({ where: { tokenHash: sha256(token) } });
  if (!inv) throw new ServiceError(404, "This onboarding link is not valid");
  if (inv.status === "REVOKED") throw new ServiceError(410, "This onboarding link has been replaced by a newer invitation");
  if (inv.expiresAt.getTime() < Date.now()) throw new ServiceError(410, "This onboarding link has expired");
  if (inv.email.toLowerCase() !== actor.email.toLowerCase()) {
    throw new ServiceError(403, "This invitation was issued to a different email address");
  }

  // New sign-ups now default to VENDOR (least privilege), so this is usually a
  // no-op. Kept as a safety net for any legacy account that still defaulted to
  // PROCUREMENT; never downgrades an internal (admin/approver) role.
  if (actor.role === "PROCUREMENT") {
    await prisma.user.update({ where: { id: actor.userId }, data: { role: "VENDOR" } });
  }
  return { vendorId: inv.vendorId };
}
