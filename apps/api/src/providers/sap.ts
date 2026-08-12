// SAP vendor-master handoff.
//
// MOCK implementation behind an interface. A real integration would call the
// SAP S/4HANA Business Partner / vendor-create API (BAPI/OData). The returned
// SAP vendor id is persisted to the real Neon database by the vendor service.

export interface SapHandoffInput {
  vendorId: string;
  legalName: string;
  pan: string | null;
  gstin: string | null;
}

export interface SapHandoffResult {
  sapVendorId: string;
  provider: string;
  handedOffAt: string;
}

export interface SapClient {
  readonly provider: string;
  createVendor(input: SapHandoffInput): Promise<SapHandoffResult>;
}

/** Raised when the ERP handoff fails; the service records it and allows a retry. */
export class SapHandoffError extends Error {}

export const mockSapClient: SapClient = {
  provider: "mock-sap-s4hana",
  async createVendor({ legalName, gstin }) {
    // Mock-only failure triggers so the FAILED → retry → SYNCED lifecycle can be
    // exercised in demos and tests. A real client would surface transport/API errors.
    if (legalName.includes("[ERPFAIL]")) {
      throw new SapHandoffError("SAP vendor-master rejected the payload (mock forced failure).");
    }
    if (!gstin) {
      throw new SapHandoffError("SAP handoff requires a GSTIN on the vendor record.");
    }
    // Deterministic-ish mock SAP vendor number (SAP vendor codes are numeric).
    const sapVendorId = `SAP-${100000 + Math.floor(Math.random() * 899999)}`;
    return {
      sapVendorId,
      provider: this.provider,
      handedOffAt: new Date().toISOString(),
    };
  },
};
