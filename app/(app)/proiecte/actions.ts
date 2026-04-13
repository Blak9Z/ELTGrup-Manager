"use server";

import { NotificationType, ProjectStatus, ProjectType, RoleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { assertProjectAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { ActionState } from "@/src/lib/action-state";
import { notifyRoles } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

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

  const count = await prisma.project.count();
  const code = `ELT-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

  const created = await prisma.project.create({
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

  revalidatePath("/proiecte");
  revalidatePath("/panou");
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

  const id = String(formData.get("id"));
  const status = formData.get("status") as ProjectStatus;
  await assertProjectAccess(currentUser, id);

  const before = await prisma.project.findUnique({ where: { id }, select: { status: true, title: true } });
  const updated = await prisma.project.update({
    where: { id },
    data: { status },
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

  revalidatePath("/proiecte");
  revalidatePath("/panou");
}

export async function deleteProject(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "DELETE");

  const id = String(formData.get("id"));
  await assertProjectAccess(currentUser, id);

  const project = await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date(), status: "CANCELED" },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "PROJECT",
    entityId: id,
    action: "PROJECT_SOFT_DELETED",
    diff: { title: project.title },
  });

  revalidatePath("/proiecte");
  revalidatePath("/panou");
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
    const result = await prisma.project.updateMany({
      where: { id: { in: scopedIds }, deletedAt: null },
      data: { deletedAt: new Date(), status: ProjectStatus.CANCELED },
    });
    await logActivity({
      userId: actor.id,
      entityType: "PROJECT_BULK",
      entityId: "MULTI",
      action: "PROJECTS_ARCHIVED_BULK",
      diff: { ids: scopedIds, affectedRows: result.count },
    });
  } else {
    if (!parsed.data.status) throw new Error("Statusul este obligatoriu.");
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
  }

  revalidatePath("/proiecte");
  revalidatePath("/panou");
}
