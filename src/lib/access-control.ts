import { PermissionAction, PermissionResource, RoleKey } from "@prisma/client";
import { hasPermission, normalizeRoleKeys } from "./rbac";

export const appModules = [
  "dashboard",
  "projects",
  "work_orders",
  "teams",
  "calendar",
  "time_tracking",
  "field",
  "materials",
  "documents",
  "clients",
  "reports",
  "subcontractors",
  "financial",
  "analytics",
  "notifications",
  "settings",
] as const;

export type AppModule = (typeof appModules)[number];

export type AuthUserLike = {
  id: string;
  email?: string | null;
  roleKeys: Array<RoleKey | string>;
};

type ModulePolicy = {
  resource: PermissionResource;
  action: PermissionAction;
  routePrefixes: string[];
  roles?: RoleKey[];
};

type PathPermissionPolicy = {
  routePrefix: string;
  resource: PermissionResource;
  action: PermissionAction;
  roles?: RoleKey[];
};

const privilegedRoles = new Set<RoleKey>([RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR]);
const companyWideRoles = new Set<RoleKey>([RoleKey.BACKOFFICE, RoleKey.ACCOUNTANT]);

export const modulePolicies: Record<AppModule, ModulePolicy> = {
  dashboard: { resource: "REPORTS", action: "VIEW", routePrefixes: ["/panou"] },
  projects: { resource: "PROJECTS", action: "VIEW", routePrefixes: ["/proiecte"] },
  work_orders: { resource: "TASKS", action: "VIEW", routePrefixes: ["/lucrari"] },
  teams: {
    resource: "TEAMS",
    action: "VIEW",
    routePrefixes: ["/echipe"],
    roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.BACKOFFICE],
  },
  calendar: { resource: "TASKS", action: "VIEW", routePrefixes: ["/calendar"] },
  time_tracking: { resource: "TIME_TRACKING", action: "VIEW", routePrefixes: ["/pontaj"] },
  field: {
    resource: "TASKS",
    action: "VIEW",
    routePrefixes: ["/teren"],
    roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.WORKER],
  },
  materials: { resource: "MATERIALS", action: "VIEW", routePrefixes: ["/materiale", "/echipamente", "/gestiune-scule"] },
  documents: { resource: "DOCUMENTS", action: "VIEW", routePrefixes: ["/documente"] },
  clients: {
    resource: "PROJECTS",
    action: "VIEW",
    routePrefixes: ["/clienti"],
    roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.BACKOFFICE, RoleKey.ACCOUNTANT],
  },
  reports: { resource: "REPORTS", action: "VIEW", routePrefixes: ["/rapoarte-zilnice"] },
  subcontractors: {
    resource: "TASKS",
    action: "VIEW",
    routePrefixes: ["/subcontractori"],
    roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.BACKOFFICE, RoleKey.ACCOUNTANT],
  },
  financial: {
    resource: "INVOICES",
    action: "VIEW",
    routePrefixes: ["/financiar"],
    roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.ACCOUNTANT],
  },
  analytics: {
    resource: "REPORTS",
    action: "VIEW",
    routePrefixes: ["/analitice"],
    roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.BACKOFFICE, RoleKey.ACCOUNTANT],
  },
  notifications: { resource: "REPORTS", action: "VIEW", routePrefixes: ["/notificari"] },
  settings: {
    resource: "SETTINGS",
    action: "VIEW",
    routePrefixes: ["/setari", "/setari/activitate"],
    roles: [RoleKey.SUPER_ADMIN, RoleKey.ADMINISTRATOR],
  },
};

export const moduleRoutePrefixes: Record<AppModule, string[]> = Object.fromEntries(
  Object.entries(modulePolicies).map(([key, policy]) => [key, policy.routePrefixes]),
) as Record<AppModule, string[]>;

const protectedApiPolicies: PathPermissionPolicy[] = [
  { routePrefix: "/api/export/materiale", resource: "MATERIALS", action: "EXPORT" },
  { routePrefix: "/api/export/pontaj", resource: "TIME_TRACKING", action: "EXPORT" },
  { routePrefix: "/api/export/financiar", resource: "INVOICES", action: "EXPORT" },
  { routePrefix: "/api/export/rapoarte", resource: "REPORTS", action: "EXPORT" },
];

function normalizePathname(pathname: string) {
  if (!pathname) return "/";
  const stripped = pathname.replace(/\/+$/g, "");
  return stripped.length ? stripped : "/";
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function hasRequiredRole(normalizedRoles: RoleKey[], requiredRoles?: RoleKey[]) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  return normalizedRoles.some((role) => requiredRoles.includes(role));
}

export function isPrivilegedUser(user: Pick<AuthUserLike, "roleKeys" | "email">) {
  return normalizeRoleKeys(user.roleKeys).some((role) => privilegedRoles.has(role));
}

export function canAccessModule(user: Pick<AuthUserLike, "roleKeys" | "email">, module: AppModule) {
  const normalizedRoles = normalizeRoleKeys(user.roleKeys);
  if (normalizedRoles.length === 0) return false;
  if (normalizedRoles.some((role) => privilegedRoles.has(role))) return true;

  const policy = modulePolicies[module];
  if (!hasRequiredRole(normalizedRoles, policy.roles)) return false;

  return hasPermission(normalizedRoles, policy.resource, policy.action, user.email);
}

export function canAccessByPermissionPolicy(user: Pick<AuthUserLike, "roleKeys" | "email">, policy: PathPermissionPolicy) {
  const normalizedRoles = normalizeRoleKeys(user.roleKeys);
  if (normalizedRoles.length === 0) return false;
  if (normalizedRoles.some((role) => privilegedRoles.has(role))) return true;
  if (!hasRequiredRole(normalizedRoles, policy.roles)) return false;
  return hasPermission(normalizedRoles, policy.resource, policy.action, user.email);
}

export function getVisibleModules(user: Pick<AuthUserLike, "roleKeys" | "email">) {
  return appModules.filter((appModule) => canAccessModule(user, appModule));
}

export function getModuleForPath(pathname: string): AppModule | null {
  const normalizedPathname = normalizePathname(pathname);

  for (const appModule of appModules) {
    if (moduleRoutePrefixes[appModule].some((prefix) => matchesPrefix(normalizedPathname, prefix))) {
      return appModule;
    }
  }
  return null;
}

export function getPathPermissionPolicy(pathname: string): PathPermissionPolicy | null {
  const normalizedPathname = normalizePathname(pathname);
  const sortedPolicies = [...protectedApiPolicies].sort((left, right) => right.routePrefix.length - left.routePrefix.length);

  for (const policy of sortedPolicies) {
    if (matchesPrefix(normalizedPathname, policy.routePrefix)) {
      return policy;
    }
  }

  return null;
}

export function canAccessPath(user: Pick<AuthUserLike, "roleKeys" | "email">, pathname: string) {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === "/") {
    return canAccessModule(user, "dashboard");
  }

  const appModule = getModuleForPath(normalizedPathname);
  if (appModule) {
    return canAccessModule(user, appModule);
  }

  const apiPolicy = getPathPermissionPolicy(normalizedPathname);
  if (apiPolicy) {
    return canAccessByPermissionPolicy(user, apiPolicy);
  }

  // Fail closed for non-API app routes to avoid silently exposing new pages.
  if (!normalizedPathname.startsWith("/api/")) {
    return false;
  }

  return true;
}

export function getDefaultModulePath(user: Pick<AuthUserLike, "roleKeys" | "email">) {
  const firstVisibleModule = getVisibleModules(user)[0];
  if (!firstVisibleModule) return "/autentificare";
  return moduleRoutePrefixes[firstVisibleModule][0] || "/autentificare";
}

export function isCompanyWideNonAdminRole(role: RoleKey) {
  return companyWideRoles.has(role);
}
