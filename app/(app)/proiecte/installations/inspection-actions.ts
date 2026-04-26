"use server";

import { InspectionResult, TaskPriority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const inspectionSchema = z.object({
  installationId: z.string().min(1),
  performedAt: z.string().optional(),
  result: z.nativeEnum(InspectionResult),
  findings: z.string().optional(),
  correctiveActions: z.string().optional(),
  nextDueAt: z.string().optional(),
  isAnnualPSI: z.coerce.boolean().default(false),
});

export async function createInstallationInspection(formData: FormData) {
  const user = await requirePermission("PROJECTS", "UPDATE");
  const raw = Object.fromEntries(formData.entries());
  const parsed = inspectionSchema.safeParse(raw);
  if (!parsed.success) return;
  const data = parsed.data;

  const installation = await prisma.projectInstallation.findUnique({
    where: { id: data.installationId, deletedAt: null },
    select: { projectId: true, name: true, status: true, serialNumber: true },
  });
  if (!installation) return;

  const nextDueAt = data.nextDueAt
    ? new Date(data.nextDueAt)
    : data.isAnnualPSI && data.performedAt
      ? new Date(new Date(data.performedAt).setFullYear(new Date(data.performedAt).getFullYear() + 1))
      : null;

  await prisma.$transaction(async (tx) => {
    const inspection = await tx.installationInspection.create({
      data: {
        installationId: data.installationId,
        performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
        performedByUserId: user.id,
        result: data.result,
        findings: data.findings || null,
        correctiveActions: data.correctiveActions || null,
        nextDueAt,
        isAnnualPSI: data.isAnnualPSI,
      },
    });

    const newStatus =
      data.result === "FAILED" || data.result === "MAJOR_ISSUES"
        ? "UNDER_MAINTENANCE"
        : installation.status === "INSTALLED"
          ? "CERTIFIED"
          : undefined;

    await tx.projectInstallation.update({
      where: { id: data.installationId },
      data: {
        nextCheckAt: nextDueAt,
        status: newStatus,
      },
    });

    if (data.result === "FAILED" || data.result === "MAJOR_ISSUES") {
      const project = await tx.project.findUnique({
        where: { id: installation.projectId },
        select: { managerId: true, code: true, title: true },
      });

      const snLabel = installation.serialNumber ? ` S/N ${installation.serialNumber}` : "";
      const summary =
        installation.name +
        snLabel +
        (data.findings ? ` — ${data.findings.slice(0, 120)}` : "");

      const wo = await tx.workOrder.create({
        data: {
          projectId: installation.projectId,
          title: `Service instalație ${installation.name}`,
          type: "SERVICE_CALL",
          description: `Verificare ${data.result} la ${summary}.\nAcțiuni corective: ${data.correctiveActions || "N/A"}`,
          siteLocation: `Proiect ${project?.code ?? ""}`,
          status: "TODO",
          priority: data.result === "FAILED" ? "HIGH" : "MEDIUM",
          responsibleId: project?.managerId || null,
          startDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await logActivity({
        userId: user.id,
        entityType: "INSPECTION",
        entityId: inspection.id,
        action: "SERVICE_CALL_AUTO",
        diff: { workOrderId: wo.id, installation: installation.name, result: data.result, projectId: installation.projectId },
      });
    }

    await logActivity({
      userId: user.id,
      entityType: "INSPECTION",
      entityId: inspection.id,
      action: "INSPECTION_CREATED",
      diff: { installation: installation.name, result: data.result, projectId: installation.projectId },
    });
  });

  revalidatePath(`/proiecte/${installation.projectId}`);
}
