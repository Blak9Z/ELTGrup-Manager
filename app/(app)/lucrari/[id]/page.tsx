import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { ActivityTimeline } from "@/src/components/ui/activity-timeline";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { assertWorkOrderAccess } from "@/src/lib/access-scope";
import { buildWorkOrderTimeline } from "@/src/lib/timeline";
import { formatDate, formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (session?.user) {
    await assertWorkOrderAccess(
      {
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      },
      id,
    ).catch(() => notFound());
  }

  const workOrder = await prisma.workOrder.findUnique({
    where: { id, deletedAt: null },
    include: {
      project: true,
      responsible: true,
      team: true,
      comments: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 },
      documents: { orderBy: { createdAt: "desc" }, take: 24 },
      timeEntries: { include: { user: true }, orderBy: { startAt: "desc" }, take: 20 },
      dailyReports: { orderBy: { reportDate: "desc" }, take: 20 },
      checklistItems: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!workOrder) notFound();

  const timeline = await buildWorkOrderTimeline(id, 40);

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title={workOrder.title}
          subtitle={`${workOrder.project.title} • ${workOrder.team?.name || "Fara echipa"} • Termen ${workOrder.dueDate ? formatDate(workOrder.dueDate) : "-"}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/calendar?projectId=${workOrder.projectId}`} className="rounded-xl border border-[var(--border)] bg-[#152538] px-3 py-1.5 text-xs font-semibold text-[#d8e6fb] hover:border-[#4f6d8f]">
                Calendar
              </Link>
              <Link href={`/pontaj?projectId=${workOrder.projectId}`} className="rounded-xl border border-[var(--border)] bg-[#152538] px-3 py-1.5 text-xs font-semibold text-[#d8e6fb] hover:border-[#4f6d8f]">
                Pontaj
              </Link>
              <Link href={`/rapoarte-zilnice?projectId=${workOrder.projectId}&workOrderId=${workOrder.id}`} className="rounded-xl border border-[var(--border)] bg-[#152538] px-3 py-1.5 text-xs font-semibold text-[#d8e6fb] hover:border-[#4f6d8f]">
                Raport zilnic
              </Link>
            </div>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Status</p>
            <div className="mt-2">
              <Badge tone={workOrder.status === "DONE" ? "success" : workOrder.status === "BLOCKED" ? "danger" : "info"}>{workOrder.status}</Badge>
            </div>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Prioritate</p>
            <p className="mt-2 font-semibold text-[#ecf2ff]">{workOrder.priority}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Responsabil</p>
            <p className="mt-2 font-semibold text-[#ecf2ff]">
              {workOrder.responsible ? `${workOrder.responsible.firstName} ${workOrder.responsible.lastName}` : "Nealocat"}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Aprobare</p>
            <p className="mt-2 text-sm text-[#ecf2ff]">
              {workOrder.approvedAt ? `Aprobata la ${formatDateTime(workOrder.approvedAt)}` : "In asteptare"}
            </p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Detalii lucrarii</h2>
            <div className="mt-3 space-y-2 text-sm text-[#d7e5f8]">
              <p><span className="text-[#9fb1c5]">Locatie:</span> {workOrder.siteLocation || "-"}</p>
              <p><span className="text-[#9fb1c5]">Start:</span> {workOrder.startDate ? formatDate(workOrder.startDate) : "-"}</p>
              <p><span className="text-[#9fb1c5]">Termen:</span> {workOrder.dueDate ? formatDate(workOrder.dueDate) : "-"}</p>
              <p><span className="text-[#9fb1c5]">Ore estimate:</span> {workOrder.estimatedHours?.toString() || "-"}</p>
              <p><span className="text-[#9fb1c5]">Descriere:</span> {workOrder.description || "-"}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Timeline lucrare</h2>
            <p className="mt-1 text-xs text-[#9fb1c5]">Cronologie unificata: update-uri, documente, pontaj, rapoarte teren si audit.</p>
            <div className="mt-3">
              <ActivityTimeline events={timeline} />
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Comentarii / update-uri</h2>
            <div className="mt-3 space-y-2">
              {workOrder.comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm">
                  <p className="text-[#dbe8fb]">{comment.content}</p>
                  <p className="mt-1 text-xs text-[#9fb1c5]">{comment.user.firstName} {comment.user.lastName} • {formatDateTime(comment.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Documente / foto</h2>
            <div className="mt-3 space-y-2">
              {workOrder.documents.map((doc) => (
                <a key={doc.id} href={doc.storagePath} target="_blank" rel="noreferrer noopener" className="block rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm hover:border-[#4f6d8f]">
                  <p className="font-semibold text-[#ecf3ff]">{doc.title}</p>
                  <p className="text-xs text-[#9fb1c5]">{doc.category} • {doc.fileName}</p>
                </a>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Aprobari si ore</h2>
            <div className="mt-3 space-y-2">
              {workOrder.timeEntries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm">
                  <p className="font-semibold text-[#ecf3ff]">{entry.user.firstName} {entry.user.lastName}</p>
                  <p className="text-xs text-[#9fb1c5]">{formatDateTime(entry.startAt)} - {entry.endAt ? formatDateTime(entry.endAt) : "in curs"}</p>
                  <p className="text-xs text-[#9fb1c5]">Status: {entry.status} • {Math.round(entry.durationMinutes / 60)}h</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
