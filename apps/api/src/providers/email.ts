import { logger } from "../lib/logger.js";

// Email delivery for onboarding invitations. This is a MOCK provider behind an
// interface (same pattern as the PAN/GST/SAP mocks): it logs the invitation
// instead of sending a real email.
//
// To enable real delivery: implement `EmailProvider` with a real service
// (e.g. Resend / SendGrid / SES / SMTP), read its API key from `env`, and export
// that instance as `emailProvider` below. No other code needs to change.

export interface InvitationEmail {
  to: string;
  vendorName: string;
  link: string;
  expiresAt: Date;
}

export interface EmailProvider {
  readonly provider: string;
  sendInvitation(email: InvitationEmail): Promise<void>;
}

export const mockEmailProvider: EmailProvider = {
  provider: "mock-email",
  async sendInvitation({ to, vendorName, link, expiresAt }) {
    logger.info(
      { to, vendorName, link, expiresAt: expiresAt.toISOString() },
      "[mock-email] onboarding invitation — swap mockEmailProvider for a real provider to actually send",
    );
  },
};

// The provider the app uses. Replace with a real implementation when ready.
export const emailProvider: EmailProvider = mockEmailProvider;
