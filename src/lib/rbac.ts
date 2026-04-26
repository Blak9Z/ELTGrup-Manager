import { PermissionAction, PermissionResource, RoleKey } from "@prisma/client";

export type SessionUser = {
  id: string;
  roleKeys: Array<RoleKey | string>;
  email?: string | null;
};

type PermissionMap = Record<
  RoleKey,
  Partial<Record<PermissionResource, PermissionAction[]>>
>;

export const permissionResourceLabels = {
  PROJECTS: "Proiecte",
  TASKS: "Lucrari",
  TEAMS: "Echipe",
  TIME_TRACKING: "Pontaj",
  MATERIALS: "Materiale",
  DOCUMENTS: "Documente",
  INVOICES: "Facturi",
  OFFERS: "Oferte",
  REPORTS: "Rapoarte",
  SETTINGS: "Setari",
  USERS: "Utilizatori",
} satisfies Record<PermissionResource, string>;

export const permissionActionLabels = {
  VIEW: "Vizualizare",
  CREATE: "Creare",
  UPDATE: "Actualizare",
  DELETE: "Stergere",
  APPROVE: "Aprobare",
  EXPORT: "Export",
  MANAGE: "Administrare",
} satisfies Record<PermissionAction, string>;

export const roleLabels: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMINISTRATOR: "Administrator",
  MAGAZIONER: "Magazioner",
  PROJECT_MANAGER: "Manager de proiect",
  SITE_MANAGER: "Sef de santier",
  BACKOFFICE: "Backoffice / Dispecer",
  WORKER: "Muncitor / Tehnician",
  ACCOUNTANT: "Contabil",
  CLIENT_VIEWER: "Client Viewer",
  SUBCONTRACTOR: "Subcontractor",
};

export function formatRoleLabels(roleKeys: Array<RoleKey | string>) {
  const normalizedRoles = normalizeRoleKeys(roleKeys);
  if (normalizedRoles.length === 0) return "Fara rol activ";
  return normalizedRoles.map((role) => roleLabels[role] || role).join(", ");
}

type RolePermissionOverview = {
  summary: string;
  restrictions: string;
  isFullAccess: boolean;
  resourceSummaries: Array<{
    resource: PermissionResource;
    label: string;
    actions: PermissionAction[];
    actionLabels: string[];
  }>;
};

export const rolePermissionMatrix: PermissionMap = {
  SUPER_ADMIN: {
    OFFERS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
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
    OFFERS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
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
  MAGAZIONER: {
    PROJECTS: ["VIEW"],
    TASKS: ["VIEW"],
    MATERIALS: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "MANAGE"],
    DOCUMENTS: ["VIEW", "CREATE"],
    REPORTS: ["VIEW"],
  },
  PROJECT_MANAGER: {
    OFFERS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    PROJECTS: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    TEAMS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    MATERIALS: ["VIEW"],
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
    MATERIALS: ["VIEW"],
    DOCUMENTS: ["VIEW", "CREATE", "UPDATE"],
    REPORTS: ["VIEW", "CREATE", "EXPORT"],
  },
  BACKOFFICE: {
    OFFERS: ["VIEW", "CREATE", "UPDATE"],
    PROJECTS: ["VIEW", "CREATE", "UPDATE"],
    TASKS: ["VIEW", "CREATE", "UPDATE"],
    TEAMS: ["VIEW", "UPDATE"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE"],
    MATERIALS: ["VIEW"],
    DOCUMENTS: ["VIEW", "CREATE", "UPDATE"],
    REPORTS: ["VIEW", "EXPORT"],
  },
  WORKER: {
    TASKS: ["VIEW", "UPDATE"],
    TIME_TRACKING: ["VIEW", "CREATE", "UPDATE"],
    MATERIALS: ["VIEW"],
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

const rolePermissionOverviews: Record<RoleKey, Pick<RolePermissionOverview, "summary" | "restrictions">> = {
  SUPER_ADMIN: {
    summary: "Acces complet la toate modulele si actiunile.",
    restrictions: "Poate administra utilizatori, setari si intregul flux operational.",
  },
  ADMINISTRATOR: {
    summary: "Acces complet la toate modulele si actiunile.",
    restrictions: "Poate gestiona platforma fara limitari operationale.",
  },
  MAGAZIONER: {
    summary: "Gestioneaza inventarul, sculele si materialele.",
    restrictions: "Are acces complet la sectiunea de materiale/scule, dar limitat la vizualizare in rest.",
  },
  PROJECT_MANAGER: {
    summary: "Coordoneaza proiecte, lucrari, echipe, pontaj, materiale, documente, facturi si rapoarte.",
    restrictions: "Nu are acces la setari sau administrarea conturilor.",
  },
  SITE_MANAGER: {
    summary: "Coordoneaza santierul: proiecte, lucrari, echipe, pontaj, materiale, documente si rapoarte.",
    restrictions: "Nu are acces la setari, utilizatori sau facturi.",
  },
  BACKOFFICE: {
    summary: "Sprijina operatiunile interne: proiecte, lucrari, echipe, pontaj, materiale, documente si rapoarte.",
    restrictions: "Nu are acces la setari, utilizatori sau facturi.",
  },
  WORKER: {
    summary: "Lucreaza pe teren: taskuri, pontaj, materiale, documente si rapoarte limitate.",
    restrictions: "Nu poate administra proiecte, utilizatori sau setari.",
  },
  ACCOUNTANT: {
    summary: "Acopera zona financiara: proiecte, facturi, pontaj si rapoarte.",
    restrictions: "Nu are acces la setari sau utilizatori.",
  },
  CLIENT_VIEWER: {
    summary: "Are vizibilitate doar pe proiecte, documente, facturi si rapoarte.",
    restrictions: "Permisiunile sunt doar de tip vizualizare.",
  },
  SUBCONTRACTOR: {
    summary: "Colaboreaza pe taskuri, documente si rapoarte.",
    restrictions: "Permisiunile sunt limitate la contextul de executie.",
  },
};

export function hasSuperAdminRole(roleKeys: Array<RoleKey | string>) {
  return normalizeRoleKeys(roleKeys).includes(RoleKey.SUPER_ADMIN);
}

export function isRoleKey(role: string): role is RoleKey {
  return (Object.values(RoleKey) as string[]).includes(role);
}

export function normalizeRoleKeys(roleKeys: Array<RoleKey | string>) {
  const validRoleSet = new Set(Object.values(RoleKey) as string[]);
  return [...new Set(roleKeys
    .map((role) => `${role}`.trim())
    .filter((role): role is RoleKey => validRoleSet.has(role)))];
}

export function getPermissionLabel(resource: PermissionResource, action: PermissionAction) {
  return `${permissionResourceLabels[resource]} / ${permissionActionLabels[action]}`;
}

export function getRolePermissionOverview(roleKey: RoleKey): RolePermissionOverview {
  const matrix = rolePermissionMatrix[roleKey] || {};
  const resourceSummaries = Object.entries(matrix)
    .map(([resource, actions]) => {
      const typedResource = resource as PermissionResource;
      const typedActions = actions || [];
      return {
        resource: typedResource,
        label: permissionResourceLabels[typedResource],
        actions: typedActions,
        actionLabels: typedActions.map((action) => permissionActionLabels[action]),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "ro"));

  return {
    ...rolePermissionOverviews[roleKey],
    isFullAccess: roleKey === RoleKey.SUPER_ADMIN || roleKey === RoleKey.ADMINISTRATOR,
    resourceSummaries,
  };
}

export function hasPermission(
  roles: Array<RoleKey | string>,
  resource: PermissionResource,
  action: PermissionAction,
  userEmail?: string | null,
) {
  void userEmail;
  const normalizedRoles = normalizeRoleKeys(roles);
  if (hasSuperAdminRole(normalizedRoles)) return true;
  return normalizedRoles.some((role) => rolePermissionMatrix[role]?.[resource]?.includes(action));
}
