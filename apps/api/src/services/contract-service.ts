import { prisma, Prisma } from "@vendor-management/db";
import {
  contractStatusLabels,
  type ContractDisplayStatus,
  type ContractDTO,
  type CreateContractInput,
  type CreateObligationInput,
  type ObligationDTO,
  type ObligationStatus,
  type ContractStatus,
  type UpdateContractStatusInput,
  type UpdateObligationInput,
  type UserRole,
} from "@vendor-management/shared";
import type { AuthContext } from "../middleware/auth.js";
import { ServiceError } from "./vendor-service.js";
import { notifyRole, safeNotify } from "./notification-service.js";

const INTERNAL_ROLES: UserRole[] = ["ADMIN", "PROCUREMENT", "FINANCE", "TAX", "LEGAL", "QUALITY", "IT_SECURITY"];
const MANAGER_ROLES: UserRole[] = ["ADMIN", "PROCUREMENT", "LEGAL"];

function assertInternal(a: AuthContext) {
  if (!INTERNAL_ROLES.includes(a.role)) throw new ServiceError(403, "This resource is only available to internal users");
}
function assertManager(a: AuthContext) {
  if (!MANAGER_ROLES.includes(a.role)) throw new ServiceError(403, "Only procurement, legal, or admin can manage contracts");
}

const DAY = 86_400_000;
const contractInclude = {
  vendor: { select: { legalName: true } },
  createdBy: { select: { name: true } },
  obligations: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.ContractInclude;
type ContractRow = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;

function toObligationDTO(o: ContractRow["obligations"][number]): ObligationDTO {
  const overdue = o.status !== "MET" && o.status !== "WAIVED" && !!o.dueDate && o.dueDate.getTime() < Date.now();
  return {
    id: o.id,
    contractId: o.contractId,
    description: o.description,
    dueDate: o.dueDate?.toISOString() ?? null,
    status: o.status,
    note: o.note,
    overdue,
    createdAt: o.createdAt.toISOString(),
  };
}

function toContractDTO(c: ContractRow): ContractDTO {
  const daysToExpiry = Math.ceil((c.endDate.getTime() - Date.now()) / DAY);
  const expired = c.status === "ACTIVE" && c.endDate.getTime() < Date.now();
  const renewalDue = c.status === "ACTIVE" && !expired && daysToExpiry <= c.renewalNoticeDays;
  let displayStatus: ContractDisplayStatus = c.status;
  if (c.status === "ACTIVE") displayStatus = expired ? "EXPIRED" : renewalDue ? "EXPIRING" : "ACTIVE";
  return {
    id: c.id,
    vendorId: c.vendorId,
    vendorName: c.vendor?.legalName ?? null,
    title: c.title,
    contractType: c.contractType,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    value: c.value?.toNumber() ?? null,
    currency: c.currency,
    status: c.status,
    displayStatus,
    autoRenew: c.autoRenew,
    renewalNoticeDays: c.renewalNoticeDays,
    daysToExpiry,
    expired,
    renewalDue,
    terms: c.terms,
    createdByName: c.createdBy?.name ?? null,
    obligations: c.obligations.map(toObligationDTO),
    createdAt: c.createdAt.toISOString(),
  };
}

export async function createContract(vendorId: string, input: CreateContractInput, actor: AuthContext): Promise<ContractDTO> {
  assertManager(actor);
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) throw new ServiceError(404, "Vendor not found");
  if (new Date(input.endDate).getTime() <= new Date(input.startDate).getTime()) {
    throw new ServiceError(400, "Contract end date must be after the start date");
  }
  const c = await prisma.contract.create({
    data: {
      vendorId,
      title: input.title,
      contractType: input.contractType ?? null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      value: input.value ?? null,
      currency: input.currency,
      status: "DRAFT",
      autoRenew: input.autoRenew,
      renewalNoticeDays: input.renewalNoticeDays,
      terms: input.terms ?? null,
      createdById: actor.userId,
    },
    include: contractInclude,
  });
  await prisma.auditLog.create({
    data: { vendorId, actorId: actor.userId, action: "CONTRACT_CREATED", detail: { title: input.title, by: actor.email } },
  });
  return toContractDTO(c);
}

export async function updateContractStatus(
  contractId: string,
  input: UpdateContractStatusInput,
  actor: AuthContext,
): Promise<ContractDTO> {
  assertManager(actor);
  const existing = await prisma.contract.findUnique({ where: { id: contractId }, select: { vendorId: true } });
  if (!existing) throw new ServiceError(404, "Contract not found");
  const c = await prisma.contract.update({ where: { id: contractId }, data: { status: input.status }, include: contractInclude });
  await prisma.auditLog.create({
    data: { vendorId: existing.vendorId, actorId: actor.userId, action: `CONTRACT_${input.status}`, detail: { contractId, by: actor.email } },
  });
  return toContractDTO(c);
}

export async function addObligation(contractId: string, input: CreateObligationInput, actor: AuthContext): Promise<ContractDTO> {
  assertManager(actor);
  const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { id: true } });
  if (!contract) throw new ServiceError(404, "Contract not found");
  await prisma.obligation.create({
    data: { contractId, description: input.description, dueDate: input.dueDate ? new Date(input.dueDate) : null, note: input.note ?? null },
  });
  const c = await prisma.contract.findUniqueOrThrow({ where: { id: contractId }, include: contractInclude });
  return toContractDTO(c);
}

export async function updateObligation(obligationId: string, input: UpdateObligationInput, actor: AuthContext): Promise<ContractDTO> {
  assertManager(actor);
  const ob = await prisma.obligation.findUnique({ where: { id: obligationId }, select: { contractId: true } });
  if (!ob) throw new ServiceError(404, "Obligation not found");
  await prisma.obligation.update({ where: { id: obligationId }, data: { status: input.status as ObligationStatus } });
  const c = await prisma.contract.findUniqueOrThrow({ where: { id: ob.contractId }, include: contractInclude });
  return toContractDTO(c);
}

export async function listContracts(actor: AuthContext, vendorId?: string): Promise<ContractDTO[]> {
  assertInternal(actor);
  const rows = await prisma.contract.findMany({
    where: vendorId ? { vendorId } : {},
    orderBy: { endDate: "asc" },
    include: contractInclude,
  });
  return rows.map(toContractDTO);
}

/** Notify legal + procurement about active contracts entering their renewal window. */
export async function sweepContractRenewals(): Promise<number> {
  const active = await prisma.contract.findMany({ where: { status: "ACTIVE" }, include: contractInclude });
  const due = active.map(toContractDTO).filter((c) => c.renewalDue || c.expired);
  for (const c of due) {
    await safeNotify(async () => {
      for (const role of ["PROCUREMENT", "LEGAL"] as const) {
        await notifyRole(role, {
          type: "CONTRACT_RENEWAL",
          title: `${c.expired ? "Contract expired" : "Contract renewal due"}: ${c.vendorName ?? ""}`.trim(),
          body: `"${c.title}" ${c.expired ? "has expired" : `expires in ${c.daysToExpiry} day(s)`}.`,
          vendorId: c.vendorId,
          relatedType: "contract",
          relatedId: c.id,
        });
      }
    });
  }
  return due.length;
}

export { contractStatusLabels };
export type { ContractStatus };
