import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { logActivity } from "@/src/lib/activity-log";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const expired = await prisma.projectInstallation.findMany({
    where: {
      deletedAt: null,
      nextCheckAt: { lt: now },
      status: { notIn: ["DECOMMISSIONED"] },
    },
    select: {
      id: true, name: true, nextCheckAt: true, status: true, serialNumber: true,
      project: { select: { id: true, code: true, title: true, managerId: true } },
    },
    orderBy: { nextCheckAt: "asc" },
    take: 50,
  });

  const expiringSoon = await prisma.projectInstallation.findMany({
    where: {
      deletedAt: null,
      nextCheckAt: { gte: now, lte: in7Days },
      status: { notIn: ["DECOMMISSIONED"] },
    },
    select: {
      id: true, name: true, nextCheckAt: true, status: true, serialNumber: true,
      project: { select: { id: true, code: true, title: true, managerId: true } },
    },
    orderBy: { nextCheckAt: "asc" },
    take: 50,
  });

  const results = { created: 0, skipped: 0 };

  for (const inst of [...expired, ...expiringSoon]) {
    const existing = await prisma.workOrder.findFirst({
      where: {
        projectId: inst.project.id,
        title: { startsWith: "Service instalație " + inst.name },
        status: { notIn: ["DONE", "CANCELED"] },
        deletedAt: null,
      },
    });

    if (existing) {
      results.skipped++;
      continue;
    }

    const snLabel = inst.serialNumber ? ` S/N ${inst.serialNumber}` : "";
    const summary = `${inst.name}${snLabel} — expiră ${inst.nextCheckAt ? new Date(inst.nextCheckAt).toLocaleDateString("ro-RO") : "necunoscut"}`;

    await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          projectId: inst.project.id,
          title: `Service instalație ${inst.name}`,
          type: "SERVICE_CALL",
          description: `Verificare periodică expirată/urgentă la ${summary}.`,
          siteLocation: `Proiect ${inst.project.code ?? ""}`,
          status: "TODO",
          priority: "HIGH",
          responsibleId: inst.project.managerId || null,
          startDate: new Date(),
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.projectInstallation.update({
        where: { id: inst.id },
        data: {
          status: inst.status === "CERTIFIED" ? "UNDER_MAINTENANCE" : inst.status,
        },
      });

      await logActivity({
        userId: null,
        entityType: "INSTALLATION",
        entityId: inst.id,
        action: "SERVICE_CALL_AUTO_CRON",
        diff: { workOrderId: wo.id, installation: inst.name, projectId: inst.project.id },
      });
    });

    results.created++;
  }

  revalidatePath("/panou");

  return NextResponse.json({
    ok: true,
    expired: expired.length,
    expiringSoon: expiringSoon.length,
    workOrdersCreated: results.created,
    skipped: results.skipped,
  });
}
