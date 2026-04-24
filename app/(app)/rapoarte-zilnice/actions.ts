"use server";

import { NotificationType, RoleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertProjectAccess, assertWorkOrderAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { notifyRoles } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const reportSchema = z.object({
  projectId: z.string().cuid(),
  workOrderId: z.string().cuid().optional(),
  reportDate: z.coerce.date(),
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

const deleteDailyReportSchema = z.object({
  id: z.string().cuid(),
});

const bulkDeleteDailyReportsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
});

function revalidateDailyReportsPaths(input?: { projectId?: string | null; workOrderId?: string | null }) {
  revalidatePath("/rapoarte-zilnice");
  revalidatePath("/panou");
  if (input?.projectId) revalidatePath(`/proiecte/${input.projectId}`);
  if (input?.workOrderId) revalidatePath(`/lucrari/${input.workOrderId}`);
}

async function assertActiveProjectAccess(user: Awaited<ReturnType<typeof requirePermission>>, projectId: string) {
  await assertProjectAccess(user, projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { deletedAt: true },
  });

  if (!project || project.deletedAt) {
    throw new Error("Proiect inexistent sau deja arhivat.");
  }
}

async function loadActiveWorkOrder(
  user: Awaited<ReturnType<typeof requirePermission>>,
  workOrderId: string,
  options?: { projectId?: string },
) {
  await assertWorkOrderAccess(user, workOrderId, options);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { deletedAt: true, projectId: true },
  });

  if (!workOrder || workOrder.deletedAt) {
    throw new Error("Lucrare inexistenta sau deja arhivata.");
  }

  if (options?.projectId && workOrder.projectId !== options.projectId) {
    throw new Error("Lucrarea selectata nu apartine proiectului selectat.");
  }

  const project = await prisma.project.findUnique({
    where: { id: workOrder.projectId },
    select: { deletedAt: true },
  });

  if (!project || project.deletedAt) {
    throw new Error("Proiect inexistent sau deja arhivat.");
  }

  return workOrder;
}

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
  await assertActiveProjectAccess(currentUser, parsed.data.projectId);
  if (parsed.data.workOrderId) {
    await loadActiveWorkOrder(currentUser, parsed.data.workOrderId, { projectId: parsed.data.projectId });
  }

  const created = await prisma.dailySiteReport.create({
    data: {
      projectId: parsed.data.projectId,
      workOrderId: parsed.data.workOrderId,
      reportDate: parsed.data.reportDate,
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

  revalidateDailyReportsPaths({ projectId: created.projectId, workOrderId: created.workOrderId });
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

export async function deleteDailyReport(formData: FormData) {
  const currentUser = await requirePermission("REPORTS", "DELETE");
  const parsed = deleteDailyReportSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("Raport zilnic invalid pentru stergere.");

  const report = await prisma.dailySiteReport.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, projectId: true, workOrderId: true, reportDate: true, createdById: true },
  });
  if (!report) throw new Error("Raportul zilnic nu exista sau a fost deja sters.");

  await assertProjectAccess(currentUser, report.projectId);

  await prisma.dailySiteReport.delete({
    where: { id: report.id },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "DAILY_REPORT",
    entityId: report.id,
    action: "DAILY_REPORT_DELETED",
    diff: {
      projectId: report.projectId,
      workOrderId: report.workOrderId,
      reportDate: report.reportDate.toISOString(),
      createdById: report.createdById,
    },
  });

  revalidateDailyReportsPaths({ projectId: report.projectId, workOrderId: report.workOrderId });
}

export async function bulkDeleteDailyReports(formData: FormData) {
  const currentUser = await requirePermission("REPORTS", "DELETE");
  const parsed = bulkDeleteDailyReportsSchema.safeParse({
    ids: formData.getAll("ids").map(String).filter(Boolean),
  });
  if (!parsed.success) throw new Error("Selectie bulk invalida pentru rapoarte zilnice.");

  const reports = await prisma.dailySiteReport.findMany({
    where: { id: { in: parsed.data.ids } },
    select: { id: true, projectId: true, workOrderId: true, reportDate: true, createdById: true },
  });
  if (reports.length === 0) throw new Error("Nu am gasit rapoartele selectate pentru stergere.");

  const scope = await resolveAccessScope(currentUser);
  const deletableReports =
    scope.projectIds === null ? reports : reports.filter((report) => scope.projectIds!.includes(report.projectId));
  if (deletableReports.length === 0) {
    throw new Error("Nu ai acces la rapoartele selectate pentru stergere.");
  }

  const deletedIds = deletableReports.map((report) => report.id);
  const deletionResult = await prisma.dailySiteReport.deleteMany({
    where: { id: { in: deletedIds } },
  });
  if (deletionResult.count === 0) {
    throw new Error("Rapoartele selectate nu au putut fi sterse.");
  }

  const projectIds = [...new Set(deletableReports.map((report) => report.projectId))];
  const workOrderIds = [
    ...new Set(deletableReports.map((report) => report.workOrderId).filter((value): value is string => Boolean(value))),
  ];

  await logActivity({
    userId: currentUser.id,
    entityType: "DAILY_REPORT_BULK",
    entityId: "MULTI",
    action: "DAILY_REPORTS_DELETED_BULK",
    diff: {
      requestedIds: parsed.data.ids,
      deletedIds,
      requestedCount: parsed.data.ids.length,
      deletedCount: deletionResult.count,
      skippedCount: parsed.data.ids.length - deletedIds.length,
      projectIds,
      workOrderIds,
    },
  });

  revalidateDailyReportsPaths();
  for (const projectId of projectIds) {
    revalidatePath(`/proiecte/${projectId}`);
  }
  for (const workOrderId of workOrderIds) {
    revalidatePath(`/lucrari/${workOrderId}`);
  }
}
