import { InventoryAssignmentStatus, RoleKey } from "@prisma/client";
import { AuthUserLike, isCompanyWideNonAdminRole, isPrivilegedUser } from "@/src/lib/access-control";
import { prisma } from "@/src/lib/prisma";
import { cache } from "react";

export type AccessScope = {
  projectIds: string[] | null;
  teamId: string | null;
};

export const resolveAccessScope = cache(async (user: AuthUserLike): Promise<AccessScope> => {
  if (isPrivilegedUser(user) || user.roleKeys.some((role) => isCompanyWideNonAdminRole(role as RoleKey))) {
    return { projectIds: null, teamId: null };
  }

  const teamProfilePromise = prisma.workerProfile.findUnique({
    where: { userId: user.id },
    select: { teamId: true },
  });

  const email = (user.email || "").toLowerCase();
  const promises: Promise<any>[] = [teamProfilePromise];

  // 1. Managed projects (PM/SM)
  if (user.roleKeys.includes(RoleKey.PROJECT_MANAGER) || user.roleKeys.includes(RoleKey.SITE_MANAGER)) {
    promises.push(
      prisma.project.findMany({
        where: { managerId: user.id, deletedAt: null },
        select: { id: true },
      })
    );
  }

  // 2. Client projects
  if (user.roleKeys.includes(RoleKey.CLIENT_VIEWER) && email) {
    promises.push(
      prisma.project.findMany({
        where: { deletedAt: null, client: { email: { equals: email, mode: "insensitive" } } },
        select: { id: true },
      })
    );
  }

  // 3. Subcontractor projects
  if (user.roleKeys.includes(RoleKey.SUBCONTRACTOR) && email) {
    promises.push(
      prisma.subcontractorAssignment.findMany({
        where: {
          subcontractor: { email: { equals: email, mode: "insensitive" } },
        },
        select: { projectId: true },
      })
    );
  }

  const results = await Promise.all(promises);
  const teamProfile = results[0];
  const teamId = teamProfile?.teamId ?? null;

  const projectIds = new Set<string>();
  
  // Add results from parallel queries
  for (let i = 1; i < results.length; i++) {
    const items = results[i];
    for (const item of items) {
      projectIds.add(item.id || item.projectId);
    }
  }

  // 4. Assigned orders (Depends on teamId, so we do it after Promise.all or we could have included it if we fetched teamProfile first)
  // To keep it fully parallel, we could fetch workerProfile separately, but let's optimize the remaining one
  if (user.roleKeys.includes(RoleKey.PROJECT_MANAGER) || user.roleKeys.includes(RoleKey.SITE_MANAGER) || user.roleKeys.includes(RoleKey.WORKER)) {
    const assignedOrders = await prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        OR: [{ responsibleId: user.id }, ...(teamId ? [{ teamId }] : [])],
      },
      select: { projectId: true },
    });
    for (const order of assignedOrders) projectIds.add(order.projectId);
  }

  return { projectIds: [...projectIds], teamId };
});

export function projectScopeWhere(projectIds: string[] | null) {
  if (projectIds === null) return {};
  if (projectIds.length === 0) return { id: { in: ["__none__"] } };
  return { id: { in: projectIds } };
}

export function workOrderScopeWhere(user: AuthUserLike, scope: AccessScope) {
  if (scope.projectIds === null) return {};
  if (user.roleKeys.includes(RoleKey.WORKER)) {
    return {
      projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] },
      OR: [{ responsibleId: user.id }, ...(scope.teamId ? [{ teamId: scope.teamId }] : [])],
    };
  }
  return { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } };
}

export function timeEntryScopeWhere(user: AuthUserLike, scope: AccessScope) {
  if (scope.projectIds === null) return {};
  if (user.roleKeys.includes(RoleKey.WORKER)) return { userId: user.id };
  return { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } };
}

export function subcontractorScopeWhere(scope: AccessScope) {
  if (scope.projectIds === null) return {};
  return {
    assignments: {
      some: {
        projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] },
      },
    },
  };
}

export function equipmentScopeWhere(user: AuthUserLike, scope: AccessScope) {
  if (scope.projectIds === null) return {};
  return {
    assignments: {
      some: {
        OR: [
          { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
          { assignedUserId: user.id },
        ],
      },
    },
  };
}

export function inventoryItemScopeWhere(user: AuthUserLike, scope: AccessScope) {
  if (scope.projectIds === null) return {};
  return {
    OR: [
      { assignments: { none: { status: { in: [InventoryAssignmentStatus.ACTIVE, InventoryAssignmentStatus.PARTIAL_RETURNED] } } } },
      {
        assignments: {
          some: {
            status: { in: [InventoryAssignmentStatus.ACTIVE, InventoryAssignmentStatus.PARTIAL_RETURNED] },
            OR: [
              { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
              { issuedToUserId: user.id },
            ],
          },
        },
      },
      { createdById: user.id },
    ],
  };
}

export async function assertProjectAccess(user: AuthUserLike, projectId: string) {
  const scope = await resolveAccessScope(user);
  if (scope.projectIds === null) return;
  if (!scope.projectIds.includes(projectId)) {
    throw new Error("Nu ai acces la proiectul selectat.");
  }
}

export async function assertWorkOrderAccess(
  user: AuthUserLike,
  workOrderId: string,
  options?: { projectId?: string },
) {
  const scope = await resolveAccessScope(user);
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, projectId: true, responsibleId: true, teamId: true },
  });
  if (!workOrder) throw new Error("Lucrare inexistenta.");
  if (options?.projectId && workOrder.projectId !== options.projectId) {
    throw new Error("Lucrarea selectata nu apartine proiectului selectat.");
  }
  if (scope.projectIds === null) return;
  if (!scope.projectIds.includes(workOrder.projectId)) throw new Error("Nu ai acces la lucrarea selectata.");

  if (user.roleKeys.includes(RoleKey.WORKER)) {
    const allowed = workOrder.responsibleId === user.id || (scope.teamId && workOrder.teamId === scope.teamId);
    if (!allowed) throw new Error("Nu ai acces la lucrarea selectata.");
  }
}

export async function assertSubcontractorAccess(user: AuthUserLike, subcontractorId: string) {
  const scope = await resolveAccessScope(user);
  if (scope.projectIds === null) return;

  const exists = await prisma.subcontractorAssignment.findFirst({
    where: {
      subcontractorId,
      projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] },
    },
    select: { id: true },
  });

  if (!exists) throw new Error("Nu ai acces la subcontractorul selectat.");
}

export async function assertEquipmentAccess(user: AuthUserLike, equipmentId: string) {
  const scope = await resolveAccessScope(user);
  if (scope.projectIds === null) return;

  const exists = await prisma.equipmentAssignment.findFirst({
    where: {
      equipmentId,
      OR: [
        { assignedUserId: user.id },
        { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
      ],
    },
    select: { id: true },
  });

  if (!exists) throw new Error("Nu ai acces la echipamentul selectat.");
}

export async function assertInventoryItemAccess(user: AuthUserLike, inventoryItemId: string) {
  const scope = await resolveAccessScope(user);
  if (scope.projectIds === null) return;

  const exists = await prisma.inventoryItem.findFirst({
    where: {
      id: inventoryItemId,
      deletedAt: null,
      ...inventoryItemScopeWhere(user, scope),
    },
    select: { id: true },
  });

  if (!exists) throw new Error("Nu ai acces la articolul de inventar selectat.");
}

export async function assertInventoryAssignmentAccess(user: AuthUserLike, assignmentId: string) {
  const scope = await resolveAccessScope(user);
  if (scope.projectIds === null) return;

  const exists = await prisma.inventoryAssignment.findFirst({
    where: {
      id: assignmentId,
      OR: [
        { issuedToUserId: user.id },
        { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
      ],
    },
    select: { id: true },
  });

  if (!exists) throw new Error("Nu ai acces la alocarea selectata.");
}

export async function assertClientAccess(user: AuthUserLike, clientId: string) {
  const scope = await resolveAccessScope(user);
  if (scope.projectIds === null) return;

  const hasProject = await prisma.project.findFirst({
    where: {
      clientId,
      deletedAt: null,
      id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] },
    },
    select: { id: true },
  });

  if (!hasProject) throw new Error("Nu ai acces la clientul selectat.");
}
