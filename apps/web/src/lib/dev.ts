import type { DevUserDTO, UserRole } from "@vendor-management/shared";
import { apiFetch } from "./http.js";

export function listUsers(): Promise<DevUserDTO[]> {
  return apiFetch<DevUserDTO[]>("/api/dev/users");
}

export function assignRole(userId: string, role: UserRole): Promise<DevUserDTO> {
  return apiFetch<DevUserDTO>("/api/dev/assign-role", {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  });
}
