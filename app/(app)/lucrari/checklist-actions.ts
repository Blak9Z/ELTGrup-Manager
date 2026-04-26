"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

export async function toggleChecklistItem(formData: FormData) {
  await requirePermission("TASKS", "UPDATE");
  const id = formData.get("id");
  const done = formData.get("done");
  const workOrderId = formData.get("workOrderId");
  if (!id || !workOrderId || typeof id !== "string" || typeof workOrderId !== "string") return;
  const isDone = done === "true";

  await prisma.taskChecklistItem.update({
    where: { id },
    data: { isDone, doneAt: isDone ? new Date() : null },
  });
  revalidatePath(`/lucrari/${workOrderId}`);
}

export async function applyChecklistTemplate(formData: FormData) {
  await requirePermission("TASKS", "UPDATE");
  const templateId = formData.get("templateId");
  const workOrderId = formData.get("workOrderId");
  if (!templateId || !workOrderId || typeof templateId !== "string" || typeof workOrderId !== "string") return;

  const template = await prisma.checklistTemplate.findUnique({ where: { id: templateId } });
  if (!template) return;

  const existing = await prisma.taskChecklistItem.findMany({ where: { workOrderId }, select: { label: true } });
  const existingLabels = new Set(existing.map((e) => e.label));

  const toCreate = template.items.filter((item) => !existingLabels.has(item)).map((label) => ({
    workOrderId,
    label,
    category: template.category,
  }));

  if (toCreate.length > 0) {
    await prisma.taskChecklistItem.createMany({ data: toCreate });
  }

  revalidatePath(`/lucrari/${workOrderId}`);
}
