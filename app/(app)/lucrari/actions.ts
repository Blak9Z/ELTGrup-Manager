"use server";

import { NotificationType, TaskPriority, WorkOrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { assertProjectAccess, assertWorkOrderAccess, resolveAccessScope, workOrderScopeWhere } from "@/src/lib/access-scope";
import { ActionState } from "@/src/lib/action-state";
import { notifyUser } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

function revalidateWorkOrderRelatedPaths(args: { workOrderId?: string; projectId?: string }) {
  revalidatePath("/lucrari");
  revalidatePath("/calendar");
  revalidatePath("/proiecte");
  revalidatePath("/panou");
  if (args.workOrderId) revalidatePath(`/lucrari/${args.workOrderId}`);
  if (args.projectId) revalidatePath(`/proiecte/${args.projectId}`);
}

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
}).superRefine((data, ctx) => {
  const isValidDate = (value?: string) => !value || !Number.isNaN(new Date(value).getTime());

  if (data.startDate && !isValidDate(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startDate"],
      message: "Data de inceput trebuie sa fie valida.",
    });
  }

  if (data.dueDate && !isValidDate(data.dueDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dueDate"],
      message: "Termenul trebuie sa fie valid.",
    });
  }

  if (data.startDate && data.dueDate && data.startDate > data.dueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dueDate"],
      message: "Termenul nu poate fi inainte de data de inceput.",
    });
  }
});

const rescheduleSchema = z.object({
  id: z.string().cuid(),
  startDate: z.string().min(1),
});
const updateStatusSchema = z.object({
  id: z.string().cuid(),
  status: z.nativeEnum(WorkOrderStatus),
});

import { createSafeAction } from "@/src/lib/safe-action";

export const createWorkOrderAction = createSafeAction(
  {
    schema: createWorkOrderSchema,
    permission: { resource: "TASKS", action: "CREATE" },
  },
  async (data, currentUser) => {
    await assertProjectAccess(currentUser, data.projectId);

    const created = await prisma.workOrder.create({
      data: {
        title: data.title,
        projectId: data.projectId,
        responsibleId: data.responsibleId,
        teamId: data.teamId,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimatedHours: data.estimatedHours,
        priority: data.priority,
        status: data.status,
        description: data.description,
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        responsibleId: true,
        dueDate: true,
        project: { select: { title: true } },
      },
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

    revalidateWorkOrderRelatedPaths({ workOrderId: created.id, projectId: created.projectId });
    return created;
  }
);

export async function updateWorkOrderStatus(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "UPDATE");
  const parsed = updateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Date invalide pentru actualizarea statusului.");
  const { id, status } = parsed.data;
  await assertWorkOrderAccess(currentUser, id);

  const before = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      status: true,
      title: true,
      responsibleId: true,
      project: { select: { title: true } },
    },
  });
  if (!before) throw new Error("Lucrarea nu a fost gasita.");

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      status: true,
      projectId: true,
      title: true,
      responsibleId: true,
      project: { select: { title: true } },
    },
  });

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

  if (before.status !== updated.status && updated.responsibleId && updated.responsibleId !== currentUser.id) {
    await notifyUser({
      userId: updated.responsibleId,
      type: updated.status === WorkOrderStatus.BLOCKED ? NotificationType.DELAYED_PROJECT : NotificationType.NEW_ASSIGNMENT,
      title: "Actualizare status lucrare",
      message: `${updated.title} (${updated.project.title}) este acum ${updated.status}.`,
      actionUrl: `/lucrari/${updated.id}`,
    });
  }

  revalidateWorkOrderRelatedPaths({ workOrderId: updated.id, projectId: updated.projectId });
}

export async function deleteWorkOrder(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "DELETE");

  const id = String(formData.get("id"));
  await assertWorkOrderAccess(currentUser, id);

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { deletedAt: new Date(), status: "CANCELED" },
    select: { id: true, projectId: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "WORK_ORDER",
    entityId: id,
    action: "WORK_ORDER_SOFT_DELETED",
  });

  revalidateWorkOrderRelatedPaths({ workOrderId: updated.id, projectId: updated.projectId });
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
    select: { id: true, startDate: true, projectId: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "WORK_ORDER",
    entityId: updated.id,
    action: "WORK_ORDER_RESCHEDULED",
    diff: { newStartDate: updated.startDate?.toISOString() ?? null },
  });

  revalidateWorkOrderRelatedPaths({ workOrderId: updated.id, projectId: updated.projectId });
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
          where: {
            id: { in: parsed.data.ids },
            deletedAt: null,
            ...workOrderScopeWhere(actor, scope),
          },
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
    const workOrdersBefore = await prisma.workOrder.findMany({
      where: { id: { in: scopedIds }, deletedAt: null, responsibleId: { not: null } },
      select: { id: true, responsibleId: true, status: true },
    });

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

    const notificationsPerResponsible = new Map<string, number>();
    for (const workOrder of workOrdersBefore) {
      if (!workOrder.responsibleId || workOrder.responsibleId === actor.id) continue;
      if (workOrder.status === parsed.data.status) continue;
      notificationsPerResponsible.set(
        workOrder.responsibleId,
        (notificationsPerResponsible.get(workOrder.responsibleId) || 0) + 1,
      );
    }

    await Promise.all(
      Array.from(notificationsPerResponsible.entries()).map(([userId, count]) =>
        notifyUser({
          userId,
          type: parsed.data.status === WorkOrderStatus.BLOCKED ? NotificationType.DELAYED_PROJECT : NotificationType.NEW_ASSIGNMENT,
          title: "Actualizare in masa lucrari",
          message: `${count} ${count === 1 ? "lucrare" : "lucrari"} au fost setate la status ${parsed.data.status}.`,
          actionUrl: "/lucrari",
        }),
      ),
    );
  }

  const affectedWorkOrders = await prisma.workOrder.findMany({
    where: { id: { in: scopedIds } },
    select: { id: true, projectId: true },
  });
  const projectIds = new Set(affectedWorkOrders.map((item) => item.projectId));
  revalidateWorkOrderRelatedPaths({});
  for (const workOrder of affectedWorkOrders) {
    revalidateWorkOrderRelatedPaths({ workOrderId: workOrder.id, projectId: workOrder.projectId });
  }
  for (const projectId of projectIds) {
    revalidatePath(`/proiecte/${projectId}`);
  }
}
