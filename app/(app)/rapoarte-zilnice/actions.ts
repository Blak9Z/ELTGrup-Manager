"use server";

import { NotificationType, RoleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertProjectAccess, assertWorkOrderAccess } from "@/src/lib/access-scope";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { notifyRoles } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const reportSchema = z.object({
  projectId: z.string().cuid(),
  workOrderId: z.string().cuid().optional(),
  reportDate: z.string().min(1),
  weather: z.string().optional(),
  workersCount: z.coerce.number().int().min(0).max(200),
  subcontractorsPresent: z.string().optional(),
  workCompleted: z.string().min(3),
  blockers: z.string().optional(),
  safetyIncidents: z.string().optional(),
  materialsReceived: z.string().optional(),
  equipmentUsed: z.string().optional(),
  signatures: z.string().optional(),
  photos: z.string().optional(),
});

async function createDailyReportInternal(formData: FormData) {
  const currentUser = await requirePermission("REPORTS", "CREATE");

  const parsed = reportSchema.safeParse({
    projectId: formData.get("projectId"),
    workOrderId: formData.get("workOrderId") || undefined,
    reportDate: formData.get("reportDate"),
    weather: formData.get("weather") || undefined,
    workersCount: formData.get("workersCount"),
    subcontractorsPresent: formData.get("subcontractorsPresent") || undefined,
    workCompleted: formData.get("workCompleted"),
    blockers: formData.get("blockers") || undefined,
    safetyIncidents: formData.get("safetyIncidents") || undefined,
    materialsReceived: formData.get("materialsReceived") || undefined,
    equipmentUsed: formData.get("equipmentUsed") || undefined,
    signatures: formData.get("signatures") || undefined,
    photos: formData.get("photos") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertProjectAccess(currentUser, parsed.data.projectId);
  if (parsed.data.workOrderId) {
    await assertWorkOrderAccess(currentUser, parsed.data.workOrderId);
  }

  const created = await prisma.dailySiteReport.create({
    data: {
      projectId: parsed.data.projectId,
      workOrderId: parsed.data.workOrderId,
      reportDate: new Date(parsed.data.reportDate),
      weather: parsed.data.weather,
      workersCount: parsed.data.workersCount,
      subcontractorsPresent: parsed.data.subcontractorsPresent,
      workCompleted: parsed.data.workCompleted,
      blockers: parsed.data.blockers,
      safetyIncidents: parsed.data.safetyIncidents,
      materialsReceived: parsed.data.materialsReceived,
      equipmentUsed: parsed.data.equipmentUsed,
      signatures: parsed.data.signatures,
      photos: parsed.data.photos ? parsed.data.photos.split(",").map((item) => item.trim()).filter(Boolean) : [],
      createdById: currentUser.id,
    },
    include: { project: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "DAILY_REPORT",
    entityId: created.id,
    action: "DAILY_REPORT_CREATED",
    diff: { projectId: created.projectId, reportDate: created.reportDate.toISOString() },
  });

  if (created.blockers) {
    await notifyRoles({
      roleKeys: [RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER],
      type: NotificationType.DELAYED_PROJECT,
      title: "Blocaj raportat in santier",
      message: `${created.project.title}: ${created.blockers}`,
      actionUrl: `/rapoarte-zilnice`,
    });
  }

  revalidatePath("/rapoarte-zilnice");
  revalidatePath("/panou");
}

export async function createDailyReportAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await createDailyReportInternal(formData);
    return { ok: true, message: "Raportul zilnic a fost salvat." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la salvare raport" };
  }
}
