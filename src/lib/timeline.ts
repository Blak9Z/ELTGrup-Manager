import { prisma } from "@/src/lib/prisma";
import type { TimelineEvent } from "@/src/components/ui/activity-timeline";

function byRecent(a: TimelineEvent, b: TimelineEvent) {
  return b.at.getTime() - a.at.getTime();
}

export async function buildProjectTimeline(projectId: string, limit = 40): Promise<TimelineEvent[]> {
  const [activity, workOrders, reports, documents, materialRequests, costs, invoices] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        OR: [{ entityId: projectId }, { entityType: "PROJECT", entityId: projectId }],
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.workOrder.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, title: true, status: true, updatedAt: true, dueDate: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.dailySiteReport.findMany({
      where: { projectId },
      select: { id: true, reportDate: true, workCompleted: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.document.findMany({
      where: { projectId },
      select: { id: true, title: true, category: true, createdAt: true, workOrderId: true },
      orderBy: { createdAt: "desc" },
      take: 16,
    }),
    prisma.materialRequest.findMany({
      where: { projectId },
      select: { id: true, status: true, quantity: true, updatedAt: true, material: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 16,
    }),
    prisma.costEntry.findMany({
      where: { projectId },
      select: { id: true, type: true, amount: true, description: true, occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: 16,
    }),
    prisma.invoice.findMany({
      where: { projectId },
      select: { id: true, invoiceNumber: true, status: true, totalAmount: true, issueDate: true },
      orderBy: { issueDate: "desc" },
      take: 16,
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const row of activity) {
    events.push({
      id: `activity-${row.id}`,
      at: row.createdAt,
      title: row.action,
      detail: `${row.user ? `${row.user.firstName} ${row.user.lastName}` : "Sistem"} • ${row.entityType}`,
      category: "Audit",
      tone: "info",
    });
  }

  for (const row of workOrders) {
    events.push({
      id: `wo-${row.id}`,
      at: row.updatedAt,
      title: `Lucrare: ${row.title}`,
      detail: `Status ${row.status}${row.dueDate ? ` • Termen ${row.dueDate.toLocaleDateString("ro-RO")}` : ""}`,
      category: "Lucrari",
      href: `/lucrari/${row.id}`,
      tone: row.status === "BLOCKED" ? "danger" : row.status === "DONE" ? "success" : "neutral",
    });
  }

  for (const row of reports) {
    events.push({
      id: `report-${row.id}`,
      at: row.createdAt,
      title: "Raport zilnic transmis",
      detail: row.workCompleted,
      category: "Rapoarte",
      href: `/rapoarte-zilnice`,
      tone: "info",
    });
  }

  for (const row of documents) {
    events.push({
      id: `doc-${row.id}`,
      at: row.createdAt,
      title: `Document incarcat: ${row.title}`,
      detail: row.workOrderId ? "Document atasat si unei lucrari" : undefined,
      category: "Documente",
      href: `/documente`,
      tone: "neutral",
    });
  }

  for (const row of materialRequests) {
    events.push({
      id: `matreq-${row.id}`,
      at: row.updatedAt,
      title: `${row.material.name} • ${row.quantity.toString()}`,
      detail: `Cerere materiale ${row.status}`,
      category: "Materiale",
      href: "/materiale",
      tone: row.status === "REJECTED" ? "danger" : row.status === "APPROVED" ? "success" : "warning",
    });
  }

  for (const row of costs) {
    events.push({
      id: `cost-${row.id}`,
      at: row.occurredAt,
      title: `${row.type} • ${row.amount.toString()} RON`,
      detail: row.description,
      category: "Costuri",
      href: "/financiar",
      tone: "warning",
    });
  }

  for (const row of invoices) {
    events.push({
      id: `inv-${row.id}`,
      at: row.issueDate,
      title: `Factura ${row.invoiceNumber}`,
      detail: `${row.status} • ${row.totalAmount.toString()} RON`,
      category: "Facturi",
      href: "/financiar",
      tone: row.status === "PAID" ? "success" : row.status === "OVERDUE" ? "danger" : "info",
    });
  }

  return events.sort(byRecent).slice(0, limit);
}

export async function buildWorkOrderTimeline(workOrderId: string, limit = 40): Promise<TimelineEvent[]> {
  const [activity, comments, documents, timeEntries, reports] = await Promise.all([
    prisma.activityLog.findMany({
      where: { entityType: "WORK_ORDER", entityId: workOrderId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.comment.findMany({
      where: { workOrderId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.document.findMany({
      where: { workOrderId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.timeEntry.findMany({
      where: { workOrderId },
      include: { user: true },
      orderBy: { startAt: "desc" },
      take: 20,
    }),
    prisma.dailySiteReport.findMany({
      where: { workOrderId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const row of activity) {
    events.push({
      id: `activity-${row.id}`,
      at: row.createdAt,
      title: row.action,
      detail: `${row.user ? `${row.user.firstName} ${row.user.lastName}` : "Sistem"} • ${row.entityType}`,
      category: "Audit",
      tone: "info",
    });
  }

  for (const row of comments) {
    events.push({
      id: `comment-${row.id}`,
      at: row.createdAt,
      title: "Comentariu nou",
      detail: `${row.user.firstName} ${row.user.lastName}: ${row.content}`,
      category: "Update",
      tone: "neutral",
    });
  }

  for (const row of documents) {
    events.push({
      id: `doc-${row.id}`,
      at: row.createdAt,
      title: `Document: ${row.title}`,
      detail: `${row.category} • ${row.fileName}`,
      category: "Documente",
      href: "/documente",
      tone: "neutral",
    });
  }

  for (const row of timeEntries) {
    events.push({
      id: `time-${row.id}`,
      at: row.startAt,
      title: `${row.user.firstName} ${row.user.lastName} • ${Math.round(row.durationMinutes / 60)}h`,
      detail: `Pontaj ${row.status}`,
      category: "Pontaj",
      href: "/pontaj",
      tone: row.status === "APPROVED" ? "success" : row.status === "REJECTED" ? "danger" : "warning",
    });
  }

  for (const row of reports) {
    events.push({
      id: `report-${row.id}`,
      at: row.createdAt,
      title: "Raport teren",
      detail: row.workCompleted,
      category: "Rapoarte",
      href: "/rapoarte-zilnice",
      tone: "info",
    });
  }

  return events.sort(byRecent).slice(0, limit);
}
