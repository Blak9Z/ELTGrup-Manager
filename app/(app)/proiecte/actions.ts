"use server";

import { NotificationType, Prisma, ProjectStatus, ProjectType, RoleKey, WorkOrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { assertProjectAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { ActionState } from "@/src/lib/action-state";
import { notifyRoles, notifyUser } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

function revalidateProjectRelatedPaths(projectId?: string) {
  revalidatePath("/proiecte");
  revalidatePath("/lucrari");
  revalidatePath("/calendar");
  revalidatePath("/panou");
  if (projectId) revalidatePath(`/proiecte/${projectId}`);
}

const createProjectSchema = z.object({
  title: z.string().min(3),
  siteAddress: z.string().min(3),
  clientId: z.string().min(1),
  type: z.nativeEnum(ProjectType),
  status: z.nativeEnum(ProjectStatus),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  contractValue: z.coerce.number().min(0),
  estimatedBudget: z.coerce.number().min(0),
}).superRefine((data, ctx) => {
  const isValidDate = (value?: string) => !value || !Number.isNaN(new Date(value).getTime());

  if (data.startDate && !isValidDate(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startDate"],
      message: "Data de start trebuie sa fie valida.",
    });
  }

  if (data.endDate && !isValidDate(data.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "Data de final trebuie sa fie valida.",
    });
  }

  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "Data de final trebuie sa fie dupa data de start.",
    });
  }
});
const updateProjectStatusSchema = z.object({
  id: z.string().cuid(),
  status: z.nativeEnum(ProjectStatus),
});

async function getNextProjectCode() {
  const year = new Date().getFullYear();
  const prefix = `ELT-${year}-`;
  const codes = await prisma.project.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });

  let maxSequence = 0;
  for (const item of codes) {
    const maybeSequence = Number(item.code.slice(prefix.length));
    if (Number.isInteger(maybeSequence) && maybeSequence > maxSequence) {
      maxSequence = maybeSequence;
    }
  }

  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

async function archiveProjectsWithWorkOrders(projectIds: string[]) {
  if (projectIds.length === 0) return { archivedProjects: 0, archivedWorkOrders: 0 };
  const now = new Date();
  const [projectsResult, workOrdersResult] = await prisma.$transaction([
    prisma.project.updateMany({
      where: { id: { in: projectIds }, deletedAt: null },
      data: { deletedAt: now, status: ProjectStatus.CANCELED },
    }),
    prisma.workOrder.updateMany({
      where: { projectId: { in: projectIds }, deletedAt: null },
      data: { deletedAt: now, status: WorkOrderStatus.CANCELED },
    }),
  ]);

  return { archivedProjects: projectsResult.count, archivedWorkOrders: workOrdersResult.count };
}

import { ProjectService } from "@/src/services/project.service";

import { createSafeAction } from "@/src/lib/safe-action";

export const createProjectAction = createSafeAction(
  {
    schema: createProjectSchema,
    permission: { resource: "PROJECTS", action: "CREATE" },
    // activityLog is handled inside Service for now, but we can move it here
  },
  async (data, currentUser) => {
    const created = await ProjectService.create({
      ...data,
      managerId: currentUser.id,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    });

    revalidateProjectRelatedPaths(created.id);
    return created;
  }
);

const updateProjectStatusActionInternal = createSafeAction(
  {
    schema: updateProjectStatusSchema,
    permission: { resource: "PROJECTS", action: "UPDATE" },
  },
  async (data, currentUser) => {
    await assertProjectAccess(currentUser, data.id);
    const updated = await ProjectService.updateStatus(data.id, data.status, currentUser.id);
    revalidateProjectRelatedPaths(data.id);
    return updated;
  }
);

export async function updateProjectStatusAction(formData: FormData) {
  await updateProjectStatusActionInternal(null, formData);
}

export async function deleteProject(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "DELETE");

  const id = String(formData.get("id"));
  await assertProjectAccess(currentUser, id);

  await ProjectService.softDelete(id, currentUser.id);

  revalidateProjectRelatedPaths(id);
}

const bulkProjectSchema = z.object({
  operation: z.enum(["SET_STATUS", "ARCHIVE"]),
  status: z.nativeEnum(ProjectStatus).optional(),
  ids: z.array(z.string().cuid()).min(1),
});

export async function bulkProjectsAction(formData: FormData) {
  const rawOperation = String(formData.get("operation") || "");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const status = formData.get("status") ? String(formData.get("status")) : undefined;

  const parsed = bulkProjectSchema.safeParse({ operation: rawOperation, status, ids });
  if (!parsed.success) {
    throw new Error("Selectie bulk invalida pentru proiecte.");
  }

  const actor =
    parsed.data.operation === "ARCHIVE"
      ? await requirePermission("PROJECTS", "DELETE")
      : await requirePermission("PROJECTS", "UPDATE");
  const scope = await resolveAccessScope(actor);
  const scopedIds =
    scope.projectIds === null ? parsed.data.ids : parsed.data.ids.filter((id) => scope.projectIds!.includes(id));
  if (scopedIds.length === 0) throw new Error("Nu ai acces la proiectele selectate.");

  if (parsed.data.operation === "ARCHIVE") {
    const result = await archiveProjectsWithWorkOrders(scopedIds);
    await logActivity({
      userId: actor.id,
      entityType: "PROJECT_BULK",
      entityId: "MULTI",
      action: "PROJECTS_ARCHIVED_BULK",
      diff: {
        ids: scopedIds,
        affectedRows: result.archivedProjects,
        archivedWorkOrders: result.archivedWorkOrders,
      },
    });
  } else {
    if (!parsed.data.status) throw new Error("Statusul este obligatoriu.");
    const projectsBefore = await prisma.project.findMany({
      where: { id: { in: scopedIds }, deletedAt: null, managerId: { not: null } },
      select: { id: true, managerId: true, status: true },
    });

    const result = await prisma.project.updateMany({
      where: { id: { in: scopedIds }, deletedAt: null },
      data: { status: parsed.data.status },
    });
    await logActivity({
      userId: actor.id,
      entityType: "PROJECT_BULK",
      entityId: "MULTI",
      action: "PROJECTS_STATUS_UPDATED_BULK",
      diff: { ids: scopedIds, status: parsed.data.status, affectedRows: result.count },
    });

    if (parsed.data.status === ProjectStatus.BLOCKED && result.count > 0) {
      await notifyRoles({
        roleKeys: [RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER],
        type: NotificationType.DELAYED_PROJECT,
        title: "Proiecte blocate",
        message: `${result.count} proiecte au fost marcate ca blocate.`,
        actionUrl: "/proiecte",
      });
    }

    const notificationsPerManager = new Map<string, number>();
    for (const project of projectsBefore) {
      if (!project.managerId || project.managerId === actor.id) continue;
      if (project.status === parsed.data.status) continue;
      notificationsPerManager.set(project.managerId, (notificationsPerManager.get(project.managerId) || 0) + 1);
    }

    await Promise.all(
      Array.from(notificationsPerManager.entries()).map(([userId, count]) =>
        notifyUser({
          userId,
          type: parsed.data.status === ProjectStatus.BLOCKED ? NotificationType.DELAYED_PROJECT : NotificationType.NEW_ASSIGNMENT,
          title: "Actualizare in masa proiecte",
          message: `${count} ${count === 1 ? "proiect" : "proiecte"} au fost setate la ${parsed.data.status}.`,
          actionUrl: "/proiecte",
        }),
      ),
    );
  }

  revalidateProjectRelatedPaths();
  for (const projectId of scopedIds) {
    revalidatePath(`/proiecte/${projectId}`);
  }
}
