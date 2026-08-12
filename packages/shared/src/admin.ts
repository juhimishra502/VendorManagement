import { z } from "zod";
import { userRoles, type UserRole } from "./vendor.js";

export const setUserRoleSchema = z.object({ role: z.enum(userRoles) });
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;

export interface AdminUserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AlertSweepResultDTO {
  contractsNotified: number;
  documentsNotified: number;
}
