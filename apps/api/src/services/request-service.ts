import { prisma, Prisma } from "@vendor-management/db";
import type {
  BusinessRequestDTO,
  CreateRequestInput,
  RequestToVendorInput,
  UpdateRequestInput,
} from "@vendor-management/shared";
import type { AuthContext } from "../middleware/auth.js";
import { createVendor, getVendorLiveStatus, ServiceError } from "./vendor-service.js";

const REQUEST_MANAGERS = ["ADMIN", "PROCUREMENT"];
const REQUEST_CREATORS = ["ADMIN", "PROCUREMENT", "BUSINESS"];

const requestInclude = { requestedBy: { select: { name: true } } } satisfies Prisma.BusinessRequestInclude;
type RequestRow = Prisma.BusinessRequestGetPayload<{ include: typeof requestInclude }>;

async function toDTO(r: RequestRow): Promise<BusinessRequestDTO> {
  const live = r.vendorId ? await getVendorLiveStatus(r.vendorId) : null;
  return {
    id: r.id,
    vendorName: r.vendorName,
    category: r.category,
    vendorType: r.vendorType,
    priority: r.priority,
    businessJustification: r.businessJustification,
    businessRequirement: r.businessRequirement,
    status: r.status,
    blockedReason: r.blockedReason,
    requestedByName: r.requestedBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    vendorId: r.vendorId,
    onboardingStatus: live?.onboardingStatus ?? null,
    progressPercent: live?.progressPercent ?? null,
    currentBlocker: live?.currentBlocker ?? null,
    currentOwner: live?.currentOwner ?? null,
    pendingAction: live?.pendingAction ?? null,
    erpStatus: live?.erpStatus ?? null,
    sapVendorId: live?.sapVendorId ?? null,
  };
}

export async function listRequests(auth: AuthContext): Promise<BusinessRequestDTO[]> {
  // Business sees only their own requests; Procurement/Admin see all.
  const where: Prisma.BusinessRequestWhereInput = REQUEST_MANAGERS.includes(auth.role)
    ? {}
    : { requestedById: auth.userId };
  const rows = await prisma.businessRequest.findMany({ where, include: requestInclude, orderBy: { createdAt: "desc" } });
  return Promise.all(rows.map(toDTO));
}

export async function getRequest(id: string, auth: AuthContext): Promise<BusinessRequestDTO> {
  const r = await prisma.businessRequest.findUnique({ where: { id }, include: requestInclude });
  if (!r) throw new ServiceError(404, "Request not found");
  if (!REQUEST_MANAGERS.includes(auth.role) && r.requestedById !== auth.userId) {
    throw new ServiceError(403, "You do not have access to this request");
  }
  return toDTO(r);
}

export async function createRequest(input: CreateRequestInput, auth: AuthContext): Promise<BusinessRequestDTO> {
  if (!REQUEST_CREATORS.includes(auth.role)) {
    throw new ServiceError(403, "You are not allowed to raise vendor requests");
  }
  const r = await prisma.businessRequest.create({
    data: {
      vendorName: input.vendorName,
      category: input.category ?? null,
      vendorType: input.vendorType ?? null,
      priority: input.priority,
      businessJustification: input.businessJustification,
      businessRequirement: input.businessRequirement ?? null,
      requestedById: auth.userId,
    },
    include: requestInclude,
  });
  await prisma.auditLog.create({
    data: { actorId: auth.userId, action: "REQUEST_CREATED", detail: { vendorName: input.vendorName, priority: input.priority } },
  });
  return toDTO(r);
}

export async function updateRequest(id: string, input: UpdateRequestInput, auth: AuthContext): Promise<BusinessRequestDTO> {
  if (!REQUEST_MANAGERS.includes(auth.role)) throw new ServiceError(403, "Only procurement can update requests");
  const r = await prisma.businessRequest.findUnique({ where: { id } });
  if (!r) throw new ServiceError(404, "Request not found");
  const updated = await prisma.businessRequest.update({
    where: { id },
    data: {
      status: input.status,
      blockedReason: input.status === "BLOCKED" ? (input.blockedReason ?? null) : null,
    },
    include: requestInclude,
  });
  await prisma.auditLog.create({
    data: { actorId: auth.userId, vendorId: r.vendorId, action: "REQUEST_STATUS_CHANGED", detail: { from: r.status, to: input.status } },
  });
  return toDTO(updated);
}

/** Procurement converts a shortlisted request into a real vendor (canonical createVendor). */
export async function convertRequestToVendor(
  id: string,
  input: RequestToVendorInput,
  auth: AuthContext,
): Promise<BusinessRequestDTO> {
  if (!REQUEST_MANAGERS.includes(auth.role)) throw new ServiceError(403, "Only procurement can create a vendor from a request");
  const r = await prisma.businessRequest.findUnique({ where: { id } });
  if (!r) throw new ServiceError(404, "Request not found");
  if (r.vendorId) throw new ServiceError(409, "A vendor has already been created for this request");

  const vendor = await createVendor(
    { legalName: r.vendorName, category: r.category ?? undefined, tier: input.tier, contactEmail: input.contactEmail },
    auth,
  );
  const updated = await prisma.businessRequest.update({
    where: { id },
    data: { vendorId: vendor.id, status: "ONBOARDING" },
    include: requestInclude,
  });
  await prisma.auditLog.create({
    data: { actorId: auth.userId, vendorId: vendor.id, action: "REQUEST_CONVERTED", detail: { requestId: id } },
  });
  return toDTO(updated);
}
