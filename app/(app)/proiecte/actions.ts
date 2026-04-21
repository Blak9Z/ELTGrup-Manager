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

async function createProjectInternal(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "CREATE");

  const parsed = createProjectSchema.safeParse({
    title: formData.get("title"),
    siteAddress: formData.get("siteAddress"),
    clientId: formData.get("clientId"),
    type: formData.get("type"),
    status: formData.get("status"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    contractValue: formData.get("contractValue"),
    estimatedBudget: formData.get("estimatedBudget"),
  });

  if (!parsed.success) throw parsed.error;

  let created: Awaited<ReturnType<typeof prisma.project.create>> | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = await getNextProjectCode();
    try {
      created = await prisma.project.create({
        data: {
          code,
          title: parsed.data.title,
          siteAddress: parsed.data.siteAddress,
          clientId: parsed.data.clientId,
          type: parsed.data.type,
          status: parsed.data.status,
          managerId: currentUser.id,
          contractValue: parsed.data.contractValue,
          estimatedBudget: parsed.data.estimatedBudget,
          startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
          endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
          description: "Proiect creat din modulul Proiecte",
        },
      });
      break;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
  }
  if (!created) {
    throw new Error("Nu am putut genera un cod unic de proiect. Incearca din nou.");
  }

  await logActivity({
    userId: currentUser.id,
    entityType: "PROJECT",
    entityId: created.id,
    action: "PROJECT_CREATED",
    diff: {
      title: created.title,
      status: created.status,
      type: created.type,
    },
  });

  await notifyRoles({
    roleKeys: [RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.BACKOFFICE],
    type: NotificationType.NEW_ASSIGNMENT,
    title: "Proiect nou creat",
    message: `A fost creat proiectul ${created.title}.`,
    actionUrl: `/proiecte/${created.id}`,
  });

  revalidateProjectRelatedPaths(created.id);
}

export async function createProjectAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await createProjectInternal(formData);
    return { ok: true, message: "Proiect creat cu succes." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, errors: error.flatten().fieldErrors, message: "Date proiect invalide." };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare proiect" };
  }
}

export async function updateProjectStatus(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "UPDATE");
  const parsed = updateProjectStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Date invalide pentru actualizarea statusului.");
  const { id, status } = parsed.data;
  await assertProjectAccess(currentUser, id);

  const before = await prisma.project.findUnique({
    where: { id },
    select: { status: true, title: true, managerId: true },
  });
  if (!before) throw new Error("Proiect inexistent.");

  const updated = await prisma.project.update({
    where: { id },
    data: { status },
    select: { id: true, title: true, status: true, managerId: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "PROJECT",
    entityId: id,
    action: "PROJECT_STATUS_UPDATED",
    diff: { beforeStatus: before?.status, afterStatus: updated.status },
  });

  if (status === "BLOCKED") {
    await notifyRoles({
      roleKeys: [RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER],
      type: NotificationType.DELAYED_PROJECT,
      title: "Proiect blocat",
      message: `Proiectul ${updated.title} a fost marcat ca blocat.`,
      actionUrl: `/proiecte/${id}`,
    });
  }

  if (before.status !== updated.status && updated.managerId && updated.managerId !== currentUser.id) {
    await notifyUser({
      userId: updated.managerId,
      type: updated.status === ProjectStatus.BLOCKED ? NotificationType.DELAYED_PROJECT : NotificationType.NEW_ASSIGNMENT,
      title: "Actualizare status proiect",
      message: `${updated.title} este acum ${updated.status}.`,
      actionUrl: `/proiecte/${updated.id}`,
    });
  }

  revalidateProjectRelatedPaths(id);
}

export async function deleteProject(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "DELETE");

  const id = String(formData.get("id"));
  await assertProjectAccess(currentUser, id);

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, title: true, deletedAt: true },
  });
  if (!project || project.deletedAt) throw new Error("Proiect inexistent sau deja arhivat.");

  const archiveResult = await archiveProjectsWithWorkOrders([id]);

  await logActivity({
    userId: currentUser.id,
    entityType: "PROJECT",
    entityId: id,
    action: "PROJECT_SOFT_DELETED",
    diff: {
      title: project.title,
      archivedWorkOrders: archiveResult.archivedWorkOrders,
    },
  });

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
