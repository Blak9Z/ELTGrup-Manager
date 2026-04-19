"use server";

import { TaskPriority, WorkOrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertProjectAccess, assertWorkOrderAccess } from "@/src/lib/access-scope";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

function revalidateScheduleRelatedPaths(args: { workOrderId?: string; projectId?: string }) {
  revalidatePath("/calendar");
  revalidatePath("/lucrari");
  revalidatePath("/proiecte");
  revalidatePath("/panou");
  if (args.workOrderId) revalidatePath(`/lucrari/${args.workOrderId}`);
  if (args.projectId) revalidatePath(`/proiecte/${args.projectId}`);
}

const createQuickTaskSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(3),
  dayLabel: z.enum(["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"]),
  teamId: z.string().cuid().optional(),
});
const updateScheduleSchema = z.object({
  id: z.string().cuid(),
  dayLabel: z.enum(["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"]),
  startDateIso: z.string().optional(),
});

function dateForWeekday(dayLabel: string) {
  const weekdays = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];
  const index = weekdays.indexOf(dayLabel);
  const now = new Date();
  const current = now.getDay();
  const mondayOffset = current === 0 ? -6 : 1 - current;
  const date = new Date(now);
  date.setDate(date.getDate() + mondayOffset + Math.max(index, 0));
  date.setHours(8, 0, 0, 0);
  return date;
}

export async function updateWorkOrderScheduleAction(input: { id: string; dayLabel: string; startDateIso: string }) {
  const currentUser = await requirePermission("TASKS", "UPDATE");
  const parsed = updateScheduleSchema.safeParse(input);
  if (!parsed.success) throw new Error("Date invalide pentru replanificare.");
  await assertWorkOrderAccess(currentUser, parsed.data.id);

  const nextStart = dateForWeekday(parsed.data.dayLabel);
  const nextDue = new Date(nextStart);
  nextDue.setHours(17, 0, 0, 0);

  const updated = await prisma.workOrder.update({
    where: { id: parsed.data.id },
    data: {
      startDate: nextStart,
      dueDate: nextDue,
    },
    select: { id: true, projectId: true },
  });

  revalidateScheduleRelatedPaths({ workOrderId: updated.id, projectId: updated.projectId });
}

export async function createCalendarTaskAction(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "CREATE");

  const parsed = createQuickTaskSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    dayLabel: formData.get("dayLabel"),
    teamId: formData.get("teamId") || undefined,
  });

  if (!parsed.success) throw new Error("Date invalide pentru task calendar.");
  await assertProjectAccess(currentUser, parsed.data.projectId);

  const startDate = dateForWeekday(parsed.data.dayLabel);
  const dueDate = new Date(startDate);
  dueDate.setHours(17, 0, 0, 0);

  const created = await prisma.workOrder.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      teamId: parsed.data.teamId,
      status: WorkOrderStatus.TODO,
      priority: TaskPriority.MEDIUM,
      startDate,
      dueDate,
      description: "Creat rapid din calendar.",
    },
    select: { id: true, projectId: true },
  });

  revalidateScheduleRelatedPaths({ workOrderId: created.id, projectId: created.projectId });
}
