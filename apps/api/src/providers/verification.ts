// External statutory-verification providers.
//
// These are MOCK implementations behind interfaces so the real integrations
// (NSDL PAN, GSTN, Udyam, penny-drop bank checks) can be swapped in later
// without touching the service layer. The *results* returned here are still
// persisted to the real Neon database by the vendor service.

export interface VerificationInput {
  pan: string;
  gstin: string;
  udyam: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountName: string;
}

export interface VerificationOutcome {
  passed: boolean;
  provider: string;
  reference: string | null;
  message: string;
  result: Record<string, unknown>;
}

export interface Verifier {
  readonly provider: string;
  verify(input: VerificationInput): Promise<VerificationOutcome>;
}

function ref(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
const UDYAM_RE = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
const IFSC_RE = /^[A-Z]{4}0[0-9A-Z]{6}$/;

export const mockPanVerifier: Verifier = {
  provider: "mock-nsdl-pan",
  async verify({ pan }) {
    const passed = PAN_RE.test(pan);
    return {
      passed,
      provider: this.provider,
      reference: passed ? ref("PANCHK") : null,
      message: passed ? `PAN ${pan} is active and matches records.` : `PAN ${pan} failed format validation.`,
      result: { pan, valid: passed, status: passed ? "ACTIVE" : "INVALID" },
    };
  },
};

export const mockGstVerifier: Verifier = {
  provider: "mock-gstn",
  async verify({ gstin, pan }) {
    // A real GSTIN embeds the PAN in positions 3-12; mock checks that link.
    const linked = gstin.slice(2, 12) === pan;
    const passed = GSTIN_RE.test(gstin) && linked;
    return {
      passed,
      provider: this.provider,
      reference: passed ? ref("GSTCHK") : null,
      message: passed
        ? `GSTIN ${gstin} is active and linked to PAN.`
        : `GSTIN ${gstin} is invalid or not linked to the supplied PAN.`,
      result: { gstin, valid: GSTIN_RE.test(gstin), linkedToPan: linked, status: passed ? "ACTIVE" : "MISMATCH" },
    };
  },
};

export const mockUdyamVerifier: Verifier = {
  provider: "mock-udyam",
  async verify({ udyam }) {
    const passed = UDYAM_RE.test(udyam);
    return {
      passed,
      provider: this.provider,
      reference: passed ? ref("UDYCHK") : null,
      message: passed ? `Udyam ${udyam} registration confirmed.` : `Udyam ${udyam} failed format validation.`,
      result: { udyam, valid: passed, enterpriseType: "MICRO" },
    };
  },
};

export const mockBankVerifier: Verifier = {
  provider: "mock-penny-drop",
  async verify({ bankAccountNumber, bankIfsc, bankAccountName }) {
    const passed = IFSC_RE.test(bankIfsc) && /^[0-9]{6,18}$/.test(bankAccountNumber);
    return {
      passed,
      provider: this.provider,
      reference: passed ? ref("BANKCHK") : null,
      message: passed
        ? `Penny-drop succeeded; account name matched "${bankAccountName}".`
        : `Penny-drop failed; account or IFSC invalid.`,
      result: {
        account: bankAccountNumber,
        ifsc: bankIfsc,
        nameMatch: passed ? "MATCH" : "UNVERIFIED",
        status: passed ? "VERIFIED" : "FAILED",
      },
    };
  },
};

export const verifiers = {
  PAN: mockPanVerifier,
  GST: mockGstVerifier,
  UDYAM: mockUdyamVerifier,
  BANK: mockBankVerifier,
} as const;
