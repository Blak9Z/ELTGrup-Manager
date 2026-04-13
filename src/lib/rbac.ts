import { PermissionAction, PermissionResource, RoleKey } from "@prisma/client";

export const SUPER_ADMIN_EMAIL = "eduard@eltgrup.com";

export type SessionUser = {
  id: string;
  roleKeys: RoleKey[];
  email?: string | null;
};

type PermissionMap = Record<
  RoleKey,
  Partial<Record<PermissionResource, PermissionAction[]>>
>;

const matrix: PermissionMap = {
  SUPER_ADMIN: {
    PROJECTS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    TEAMS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    MATERIALS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    DOCUMENTS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    INVOICES: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    REPORTS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    SETTINGS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    USERS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
  },
  ADMINISTRATOR: {
    PROJECTS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    TEAMS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    MATERIALS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    DOCUMENTS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    INVOICES: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    REPORTS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    SETTINGS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    USERS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
  },
  PROJECT_MANAGER: {
    PROJECTS: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    TEAMS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    MATERIALS: ["VIEW", "CREATE", "UPDATE", "APPROVE"],
    DOCUMENTS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    INVOICES: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    REPORTS: ["VIEW", "CREATE", "EXPORT"],
    USERS: ["VIEW"],
  },
  SITE_MANAGER: {
    PROJECTS: ["VIEW", "UPDATE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "APPROVE"],
    TEAMS: ["VIEW", "UPDATE"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE", "APPROVE"],
    MATERIALS: ["VIEW", "CREATE", "UPDATE", "APPROVE"],
    DOCUMENTS: ["VIEW", "CREATE", "UPDATE"],
    REPORTS: ["VIEW", "CREATE", "EXPORT"],
  },
  BACKOFFICE: {
    PROJECTS: ["VIEW", "CREATE", "UPDATE"],
    TASKS: ["VIEW", "CREATE", "UPDATE"],
    TEAMS: ["VIEW", "UPDATE"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE"],
    MATERIALS: ["VIEW", "CREATE", "UPDATE"],
    DOCUMENTS: ["VIEW", "CREATE", "UPDATE"],
    REPORTS: ["VIEW", "EXPORT"],
  },
  WORKER: {
    TASKS: ["VIEW", "UPDATE"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE"],
    MATERIALS: ["VIEW", "CREATE"],
    DOCUMENTS: ["VIEW", "CREATE"],
    REPORTS: ["VIEW", "CREATE"],
  },
  ACCOUNTANT: {
    PROJECTS: ["VIEW"],
    INVOICES: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    REPORTS: ["VIEW", "EXPORT"],
    TIME_TRACKING: ["VIEW", "EXPORT"],
  },
  CLIENT_VIEWER: {
    PROJECTS: ["VIEW"],
    DOCUMENTS: ["VIEW"],
    INVOICES: ["VIEW"],
    REPORTS: ["VIEW"],
  },
  SUBCONTRACTOR: {
    TASKS: ["VIEW", "UPDATE"],
    DOCUMENTS: ["VIEW", "CREATE"],
    REPORTS: ["VIEW", "CREATE"],
  },
};

export function isAbsoluteSuperAdmin(email?: string | null) {
  return (email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function hasPermission(
  roles: RoleKey[],
  resource: PermissionResource,
  action: PermissionAction,
  userEmail?: string | null,
) {
  if (isAbsoluteSuperAdmin(userEmail)) return true;
  return roles.some((role) => matrix[role]?.[resource]?.includes(action));
}
