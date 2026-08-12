import type {
  ContractDTO,
  ContractStatus,
  CreateContractInput,
  CreateObligationInput,
  ObligationStatus,
} from "@vendor-management/shared";
import { apiFetch } from "./http.js";

export function listVendorContracts(vendorId: string): Promise<ContractDTO[]> {
  return apiFetch<ContractDTO[]>(`/api/vendors/${vendorId}/contracts`);
}

export function createContract(vendorId: string, input: CreateContractInput): Promise<ContractDTO> {
  return apiFetch<ContractDTO>(`/api/vendors/${vendorId}/contracts`, { method: "POST", body: JSON.stringify(input) });
}

export function setContractStatus(id: string, status: ContractStatus): Promise<ContractDTO> {
  return apiFetch<ContractDTO>(`/api/contracts/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
}

export function addObligation(contractId: string, input: CreateObligationInput): Promise<ContractDTO> {
  return apiFetch<ContractDTO>(`/api/contracts/${contractId}/obligations`, { method: "POST", body: JSON.stringify(input) });
}

export function updateObligation(obligationId: string, status: ObligationStatus): Promise<ContractDTO> {
  return apiFetch<ContractDTO>(`/api/contracts/obligations/${obligationId}`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
