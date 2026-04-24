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
      comments: { include: { user: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 20 },
      documents: { orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 24 },
      timeEntries: { include: { user: true }, orderBy: [{ startAt: "desc" }, { id: "asc" }], take: 20 },
      dailyReports: { orderBy: [{ reportDate: "desc" }, { id: "asc" }], take: 20 },
      checklistItems: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
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
              <Link href={`/calendar?projectId=${workOrder.projectId}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Calendar
              </Link>
              <Link href={`/pontaj?projectId=${workOrder.projectId}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Pontaj
              </Link>
              <Link href={`/rapoarte-zilnice?projectId=${workOrder.projectId}&workOrderId=${workOrder.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Raport zilnic
              </Link>
            </div>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Status</p>
            <div className="mt-2">
              <Badge tone={workOrder.status === "DONE" ? "success" : workOrder.status === "BLOCKED" ? "danger" : "info"}>{workOrder.status}</Badge>
            </div>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Prioritate</p>
            <p className="mt-2 font-semibold text-[var(--foreground)]">{workOrder.priority}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Responsabil</p>
            <p className="mt-2 font-semibold text-[var(--foreground)]">
              {workOrder.responsible ? `${workOrder.responsible.firstName} ${workOrder.responsible.lastName}` : "Nealocat"}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Aprobare</p>
            <p className="mt-2 text-sm text-[var(--foreground)]">
              {workOrder.approvedAt ? `Aprobata la ${formatDateTime(workOrder.approvedAt)}` : "In asteptare"}
            </p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Detalii lucrarii</h2>
            <div className="mt-3 space-y-2 text-sm text-[var(--muted-strong)]">
              <p><span className="text-[var(--muted)]">Locatie:</span> {workOrder.siteLocation || "-"}</p>
              <p><span className="text-[var(--muted)]">Start:</span> {workOrder.startDate ? formatDate(workOrder.startDate) : "-"}</p>
              <p><span className="text-[var(--muted)]">Termen:</span> {workOrder.dueDate ? formatDate(workOrder.dueDate) : "-"}</p>
              <p><span className="text-[var(--muted)]">Ore estimate:</span> {workOrder.estimatedHours?.toString() || "-"}</p>
              <p><span className="text-[var(--muted)]">Descriere:</span> {workOrder.description || "-"}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Timeline lucrare</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Cronologie unificata: update-uri, documente, pontaj, rapoarte teren si audit.</p>
            <div className="mt-3">
              <ActivityTimeline events={timeline} />
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Comentarii / update-uri</h2>
            <div className="mt-3 space-y-2">
              {workOrder.comments.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista comentarii pe aceasta lucrare.
                </p>
              ) : null}
              {workOrder.comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm">
                  <p className="text-[var(--muted-strong)]">{comment.content}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{comment.user.firstName} {comment.user.lastName} • {formatDateTime(comment.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Documente / foto</h2>
            <div className="mt-3 space-y-2">
              {workOrder.documents.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista documente sau fotografii incarcate.
                </p>
              ) : null}
              {workOrder.documents.map((doc) => (
                <a key={doc.id} href={doc.storagePath} target="_blank" rel="noreferrer noopener" className="block rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm hover:border-[var(--border-strong)]">
                  <p className="font-semibold text-[var(--foreground)]">{doc.title}</p>
                  <p className="text-xs text-[var(--muted)]">{doc.category} • {doc.fileName}</p>
                </a>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Aprobari si ore</h2>
            <div className="mt-3 space-y-2">
              {workOrder.timeEntries.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista inregistrari de pontaj pe aceasta lucrare.
                </p>
              ) : null}
              {workOrder.timeEntries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{entry.user.firstName} {entry.user.lastName}</p>
                  <p className="text-xs text-[var(--muted)]">{formatDateTime(entry.startAt)} - {entry.endAt ? formatDateTime(entry.endAt) : "in curs"}</p>
                  <p className="text-xs text-[var(--muted)]">Status: {entry.status} • {Math.round(entry.durationMinutes / 60)}h</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
