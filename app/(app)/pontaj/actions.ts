"use server";

import { NotificationType, TimeEntryStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertProjectAccess, assertWorkOrderAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState } from "@/src/lib/action-state";
import { notifyUser } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const timeEntrySchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().optional(),
  workOrderId: z.string().optional(),
  startAt: z.string().optional(),
  startDate: z.string().optional(),
  startTime: z.string().optional(),
  endAt: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  breakMinutes: z.coerce.number().min(0).max(600).default(0),
  note: z.string().optional(),
});

const bulkTimeEntrySchema = z.object({
  operation: z.enum(["APPROVE", "REJECT"]),
  ids: z.array(z.string().cuid()).min(1),
});

function combineDateTime(date?: string, time?: string) {
  if (!date) return null;
  const normalizedTime = time && time.trim().length > 0 ? time : "00:00";
  return new Date(`${date}T${normalizedTime}`);
}

async function createTimeEntryInternal(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "CREATE");

  const parsed = timeEntrySchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId") || undefined,
    workOrderId: formData.get("workOrderId") || undefined,
    startAt: formData.get("startAt") || undefined,
    startDate: formData.get("startDate") || undefined,
    startTime: formData.get("startTime") || undefined,
    endAt: formData.get("endAt") || undefined,
    endDate: formData.get("endDate") || undefined,
    endTime: formData.get("endTime") || undefined,
    breakMinutes: formData.get("breakMinutes") || 0,
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertProjectAccess(currentUser, parsed.data.projectId);
  if (parsed.data.workOrderId) {
    await assertWorkOrderAccess(currentUser, parsed.data.workOrderId);
  }

  const startAt =
    (parsed.data.startAt ? new Date(parsed.data.startAt) : null) ||
    combineDateTime(parsed.data.startDate, parsed.data.startTime);
  const endAt =
    (parsed.data.endAt ? new Date(parsed.data.endAt) : null) ||
    combineDateTime(parsed.data.endDate, parsed.data.endTime);

  if (!startAt || Number.isNaN(startAt.getTime())) {
    throw new Error("Selecteaza data si ora de inceput.");
  }

  if (endAt && Number.isNaN(endAt.getTime())) {
    throw new Error("Data/ora de final este invalida.");
  }

  const canManageTeamPontaj =
    currentUser.roleKeys.some((role) =>
      ["SUPER_ADMIN", "ADMINISTRATOR", "PROJECT_MANAGER", "SITE_MANAGER", "BACKOFFICE"].includes(role),
    );

  if (!canManageTeamPontaj) {
    throw new Error("Pontajul poate fi introdus doar de ingineri/manageri de proiect.");
  }

  const targetUserId = parsed.data.userId || currentUser.id;

  const computedEndAt = endAt || (() => {
    const fallback = new Date(startAt);
    fallback.setHours(17, 0, 0, 0);
    if (fallback < startAt) {
      fallback.setHours(startAt.getHours(), startAt.getMinutes(), 0, 0);
    }
    return fallback;
  })();

  const durationMinutes = Math.max(
    0,
    Math.round((computedEndAt.getTime() - startAt.getTime()) / 60000) - parsed.data.breakMinutes,
  );
  const overtimeMinutes = Math.max(0, durationMinutes - 8 * 60);

  const created = await prisma.timeEntry.create({
    data: {
      userId: targetUserId,
      projectId: parsed.data.projectId,
      workOrderId: parsed.data.workOrderId,
      startAt,
      endAt: computedEndAt,
      breakMinutes: parsed.data.breakMinutes,
      durationMinutes,
      overtimeMinutes,
      status: TimeEntryStatus.SUBMITTED,
      note: parsed.data.note,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "TIME_ENTRY",
    entityId: created.id,
    action: "TIME_ENTRY_CREATED",
    diff: {
      projectId: created.projectId,
      workOrderId: created.workOrderId,
      durationMinutes: created.durationMinutes,
      breakMinutes: created.breakMinutes,
    },
  });

  revalidatePath("/pontaj");
  revalidatePath("/panou");
}

export async function createTimeEntryAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await createTimeEntryInternal(formData);
    return { ok: true, message: "Pontaj inregistrat cu succes." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Eroare pontaj" };
  }
}

export async function approveTimeEntry(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "APPROVE");

  const id = String(formData.get("id"));
  const current = await prisma.timeEntry.findUnique({ where: { id }, select: { projectId: true } });
  if (!current) throw new Error("Pontaj inexistent.");
  await assertProjectAccess(currentUser, current.projectId);

  const entry = await prisma.timeEntry.update({
    where: { id },
    data: {
      status: TimeEntryStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: currentUser.id,
    },
  });

  const worker = await prisma.workerProfile.findUnique({
    where: { userId: entry.userId },
    select: { hourlyRate: true },
  });
  const hourlyRate = Number(worker?.hourlyRate || 0);
  if (hourlyRate > 0) {
    const laborAmount = (entry.durationMinutes / 60) * hourlyRate;
    const existingLabor = await prisma.costEntry.findFirst({
      where: {
        projectId: entry.projectId,
        type: "LABOR",
        description: `Pontaj #${entry.id}`,
      },
      select: { id: true },
    });

    if (!existingLabor) {
      await prisma.costEntry.create({
        data: {
          projectId: entry.projectId,
          type: "LABOR",
          description: `Pontaj #${entry.id}`,
          amount: laborAmount,
          occurredAt: new Date(),
          approvedById: currentUser.id,
        },
      });
    }
  }

  await logActivity({
    userId: currentUser.id,
    entityType: "TIME_ENTRY",
    entityId: entry.id,
    action: "TIME_ENTRY_APPROVED",
  });

  if (entry.userId !== currentUser.id) {
    await notifyUser({
      userId: entry.userId,
      type: NotificationType.TIMESHEET_APPROVAL_REQUIRED,
      title: "Pontaj aprobat",
      message: "Inregistrarea ta de pontaj a fost aprobata.",
      actionUrl: "/pontaj",
    });
  }

  revalidatePath("/pontaj");
}

export async function bulkTimeEntriesAction(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "APPROVE");

  const operation = String(formData.get("operation") || "");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const parsed = bulkTimeEntrySchema.safeParse({ operation, ids });
  if (!parsed.success) throw new Error("Selectie bulk invalida pentru pontaj.");

  const status = parsed.data.operation === "APPROVE" ? TimeEntryStatus.APPROVED : TimeEntryStatus.REJECTED;
  const scope = await resolveAccessScope(currentUser);
  let scopedIds = parsed.data.ids;
  if (scope.projectIds !== null) {
    const allowed = await prisma.timeEntry.findMany({
      where: { id: { in: parsed.data.ids }, projectId: { in: scope.projectIds } },
      select: { id: true },
    });
    const allowedSet = new Set(allowed.map((row) => row.id));
    scopedIds = parsed.data.ids.filter((id) => allowedSet.has(id));
  }
  if (scopedIds.length === 0) throw new Error("Nu ai acces la pontajele selectate.");
  const result = await prisma.timeEntry.updateMany({
    where: { id: { in: scopedIds }, status: TimeEntryStatus.SUBMITTED },
    data: {
      status,
      approvedAt: new Date(),
      approvedById: currentUser.id,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "TIME_ENTRY_BULK",
    entityId: "MULTI",
    action: `TIME_ENTRIES_${status}_BULK`,
    diff: { ids: scopedIds, affectedRows: result.count },
  });

  revalidatePath("/pontaj");
  revalidatePath("/panou");
}
