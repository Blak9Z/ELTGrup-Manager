import { PermissionAction, PermissionResource, RoleKey } from "@prisma/client";
import { hasPermission, normalizeRoleKeys } from "@/src/lib/rbac";

export type AppModule =
  | "dashboard"
  | "projects"
  | "work_orders"
  | "calendar"
  | "time_tracking"
  | "field"
  | "materials"
  | "documents"
  | "clients"
  | "reports"
  | "subcontractors"
  | "financial"
  | "analytics"
  | "notifications"
  | "settings";

export type AuthUserLike = {
  id: string;
  email?: string | null;
  roleKeys: Array<RoleKey | string>;
};

const privilegedRoles = new Set<RoleKey>([RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR]);
const companyWideRoles = new Set<RoleKey>([RoleKey.BACKOFFICE, RoleKey.ACCOUNTANT]);

const modulePolicies: Record<AppModule, { resource: PermissionResource; action: PermissionAction; roles?: RoleKey[] }> = {
  dashboard: { resource: "REPORTS", action: "VIEW" },
  projects: { resource: "PROJECTS", action: "VIEW" },
  work_orders: { resource: "TASKS", action: "VIEW" },
  calendar: { resource: "TASKS", action: "VIEW" },
  time_tracking: { resource: "TIME_TRACKING", action: "VIEW" },
  field: { resource: "TASKS", action: "VIEW", roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.WORKER] },
  materials: { resource: "MATERIALS", action: "VIEW" },
  documents: { resource: "DOCUMENTS", action: "VIEW" },
  clients: { resource: "PROJECTS", action: "VIEW", roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.BACKOFFICE, RoleKey.ACCOUNTANT] },
  reports: { resource: "REPORTS", action: "VIEW" },
  subcontractors: { resource: "TASKS", action: "VIEW", roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.BACKOFFICE] },
  financial: { resource: "INVOICES", action: "VIEW", roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.BACKOFFICE, RoleKey.ACCOUNTANT] },
  analytics: { resource: "REPORTS", action: "VIEW", roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.BACKOFFICE, RoleKey.ACCOUNTANT] },
  notifications: { resource: "REPORTS", action: "VIEW" },
  settings: { resource: "SETTINGS", action: "VIEW", roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR] },
};

export const moduleRoutePrefixes: Record<AppModule, string[]> = {
  dashboard: ["/panou"],
  projects: ["/proiecte"],
  work_orders: ["/lucrari"],
  calendar: ["/calendar"],
  time_tracking: ["/pontaj"],
  field: ["/teren"],
  materials: ["/materiale", "/echipamente"],
  documents: ["/documente"],
  clients: ["/clienti"],
  reports: ["/rapoarte-zilnice"],
  subcontractors: ["/subcontractori"],
  financial: ["/financiar"],
  analytics: ["/analitice"],
  notifications: ["/notificari"],
  settings: ["/setari"],
};

export function isPrivilegedUser(user: Pick<AuthUserLike, "roleKeys" | "email">) {
  return normalizeRoleKeys(user.roleKeys).some((role) => privilegedRoles.has(role));
}

export function canAccessModule(user: Pick<AuthUserLike, "roleKeys" | "email">, module: AppModule) {
  if (isPrivilegedUser(user)) return true;

  const policy = modulePolicies[module];
  const normalizedRoles = normalizeRoleKeys(user.roleKeys);
  if (policy.roles && !normalizedRoles.some((role) => policy.roles!.includes(role))) {
    // role keys can come from JWT as strings
    return false;
  }

  return hasPermission(normalizedRoles, policy.resource, policy.action, user.email);
}

export function getVisibleModules(user: Pick<AuthUserLike, "roleKeys" | "email">) {
  const modules = Object.keys(modulePolicies) as AppModule[];
  return modules.filter((appModule) => canAccessModule(user, appModule));
}

export function getModuleForPath(pathname: string): AppModule | null {
  const modules = Object.keys(moduleRoutePrefixes) as AppModule[];
  for (const appModule of modules) {
    if (moduleRoutePrefixes[appModule].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return appModule;
    }
  }
  return null;
}
export function isCompanyWideNonAdminRole(role: RoleKey) {
  return companyWideRoles.has(role as RoleKey);
}
