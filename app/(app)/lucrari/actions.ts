"use server";

import { NotificationType, TaskPriority, WorkOrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { assertProjectAccess, assertWorkOrderAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { ActionState } from "@/src/lib/action-state";
import { notifyUser } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const createWorkOrderSchema = z.object({
  title: z.string().min(3),
  projectId: z.string().min(1),
  responsibleId: z.string().optional(),
  teamId: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.coerce.number().min(0).default(0),
  priority: z.nativeEnum(TaskPriority),
  status: z.nativeEnum(WorkOrderStatus),
  description: z.string().optional(),
});

const rescheduleSchema = z.object({
  id: z.string().cuid(),
  startDate: z.string().min(1),
});

async function createWorkOrderInternal(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "CREATE");

  const parsed = createWorkOrderSchema.safeParse({
    title: formData.get("title"),
    projectId: formData.get("projectId"),
    responsibleId: formData.get("responsibleId") || undefined,
    teamId: formData.get("teamId") || undefined,
    startDate: formData.get("startDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    estimatedHours: formData.get("estimatedHours"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertProjectAccess(currentUser, parsed.data.projectId);

  const created = await prisma.workOrder.create({
    data: {
      title: parsed.data.title,
      projectId: parsed.data.projectId,
      responsibleId: parsed.data.responsibleId,
      teamId: parsed.data.teamId,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      estimatedHours: parsed.data.estimatedHours,
      priority: parsed.data.priority,
      status: parsed.data.status,
      description: parsed.data.description,
    },
    include: { project: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "WORK_ORDER",
    entityId: created.id,
    action: "WORK_ORDER_CREATED",
    diff: {
      title: created.title,
      projectId: created.projectId,
      responsibleId: created.responsibleId,
      dueDate: created.dueDate?.toISOString() ?? null,
    },
  });

  if (created.responsibleId) {
    await notifyUser({
      userId: created.responsibleId,
      type: NotificationType.NEW_ASSIGNMENT,
      title: "Ai primit o lucrare noua",
      message: `${created.title} (${created.project.title})`,
      actionUrl: "/lucrari",
    });
  }

  revalidatePath("/lucrari");
  revalidatePath("/calendar");
}

export async function createWorkOrderAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await createWorkOrderInternal(formData);
    return { ok: true, message: "Lucrare creata cu succes." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, errors: error.flatten().fieldErrors, message: "Date lucrare invalide." };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare lucrare" };
  }
}

export async function updateWorkOrderStatus(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "UPDATE");

  const id = String(formData.get("id"));
  const status = formData.get("status") as WorkOrderStatus;
  await assertWorkOrderAccess(currentUser, id);

  const before = await prisma.workOrder.findUnique({ where: { id }, select: { status: true } });
  const updated = await prisma.workOrder.update({ where: { id }, data: { status } });

  await logActivity({
    userId: currentUser.id,
    entityType: "WORK_ORDER",
    entityId: id,
    action: "WORK_ORDER_STATUS_UPDATED",
    diff: {
      beforeStatus: before?.status ?? null,
      afterStatus: updated.status,
    },
  });

  revalidatePath("/lucrari");
  revalidatePath("/calendar");
}

export async function deleteWorkOrder(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "DELETE");

  const id = String(formData.get("id"));
  await assertWorkOrderAccess(currentUser, id);

  await prisma.workOrder.update({
    where: { id },
    data: { deletedAt: new Date(), status: "CANCELED" },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "WORK_ORDER",
    entityId: id,
    action: "WORK_ORDER_SOFT_DELETED",
  });

  revalidatePath("/lucrari");
  revalidatePath("/calendar");
}

export async function rescheduleWorkOrder(input: { id: string; startDate: string }) {
  const currentUser = await requirePermission("TASKS", "UPDATE");
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) throw new Error("Date planificare invalide.");
  await assertWorkOrderAccess(currentUser, parsed.data.id);

  const startDate = new Date(parsed.data.startDate);
  if (Number.isNaN(startDate.getTime())) throw new Error("Data planificata invalida.");

  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + 1);

  const updated = await prisma.workOrder.update({
    where: { id: parsed.data.id },
    data: { startDate, dueDate },
    select: { id: true, startDate: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "WORK_ORDER",
    entityId: updated.id,
    action: "WORK_ORDER_RESCHEDULED",
    diff: { newStartDate: updated.startDate?.toISOString() ?? null },
  });

  revalidatePath("/lucrari");
  revalidatePath("/calendar");
}

const bulkWorkOrderSchema = z.object({
  operation: z.enum(["SET_STATUS", "DELETE"]),
  status: z.nativeEnum(WorkOrderStatus).optional(),
  ids: z.array(z.string().cuid()).min(1),
});

export async function bulkWorkOrdersAction(formData: FormData) {
  const operation = String(formData.get("operation") || "");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const status = formData.get("status") ? String(formData.get("status")) : undefined;

  const parsed = bulkWorkOrderSchema.safeParse({ operation, status, ids });
  if (!parsed.success) throw new Error("Selectie bulk invalida pentru lucrari.");

  const actor =
    parsed.data.operation === "DELETE"
      ? await requirePermission("TASKS", "DELETE")
      : await requirePermission("TASKS", "UPDATE");
  const scope = await resolveAccessScope(actor);
  let scopedIds = parsed.data.ids;
  if (scope.projectIds !== null) {
    const allowedIds = new Set(
      (
        await prisma.workOrder.findMany({
          where: { id: { in: parsed.data.ids }, projectId: { in: scope.projectIds } },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    scopedIds = parsed.data.ids.filter((id) => allowedIds.has(id));
  }
  if (scopedIds.length === 0) throw new Error("Nu ai acces la lucrarile selectate.");

  if (parsed.data.operation === "DELETE") {
    const result = await prisma.workOrder.updateMany({
      where: { id: { in: scopedIds }, deletedAt: null },
      data: { deletedAt: new Date(), status: WorkOrderStatus.CANCELED },
    });
    await logActivity({
      userId: actor.id,
      entityType: "WORK_ORDER_BULK",
      entityId: "MULTI",
      action: "WORK_ORDERS_SOFT_DELETED_BULK",
      diff: { ids: scopedIds, affectedRows: result.count },
    });
  } else {
    if (!parsed.data.status) throw new Error("Statusul este obligatoriu.");
    const result = await prisma.workOrder.updateMany({
      where: { id: { in: scopedIds }, deletedAt: null },
      data: { status: parsed.data.status },
    });
    await logActivity({
      userId: actor.id,
      entityType: "WORK_ORDER_BULK",
      entityId: "MULTI",
      action: "WORK_ORDERS_STATUS_UPDATED_BULK",
      diff: { ids: scopedIds, status: parsed.data.status, affectedRows: result.count },
    });
  }

  revalidatePath("/lucrari");
  revalidatePath("/calendar");
}
