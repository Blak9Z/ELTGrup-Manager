import { ChecklistCategory } from "@prisma/client";
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
import { getChecklistTemplates } from "@/app/api/checklist-templates/actions";
import { applyChecklistTemplate, toggleChecklistItem } from "../checklist-actions";

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
      checklistItems: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, label: true, isDone: true, category: true } },
    },
  });

  if (!workOrder) notFound();

  const timeline = await buildWorkOrderTimeline(id, 40);
  const templates = await getChecklistTemplates();
  const templatesByCategory = templates.reduce((acc, t) => { acc[t.category] = [...(acc[t.category] || []), t]; return acc; }, {} as Record<ChecklistCategory, typeof templates>);

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
          <Card className="xl:col-span-2">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Checklist verificari</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Puncte de control grupate pe categorie: PSI, Electric, BMS.</p>
            <div className="mt-3 space-y-3">
                {( ["PSI", "ELECTRIC", "BMS", "GENERAL"] as const ).map((cat) => {
                const category = cat as ChecklistCategory;
                const items = workOrder.checklistItems.filter((i) => i.category === category || (!i.category && category === "GENERAL"));
                const tpls = templatesByCategory[cat] || [];
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                        {category === "PSI" ? "PSI" : category === "ELECTRIC" ? "Electric" : category === "BMS" ? "BMS" : "General"}
                      </h3>
                      {tpls.length > 0 ? (
                        <form action={applyChecklistTemplate} className="flex items-center gap-1.5">
                          <input type="hidden" name="workOrderId" value={workOrder.id} />
                          <select name="templateId" className="h-6 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[10px] text-[var(--foreground)]">
                            <option value="">Adauga din template</option>
                            {tpls.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button type="submit" className="rounded-md bg-[var(--surface-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-strong)] transition-colors hover:bg-[var(--surface-border)]">+</button>
                        </form>
                      ) : null}
                    </div>
                    {items.length === 0 ? (
                      <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-2.5 text-[11px] text-[var(--muted)]">Niciun punct de control.</p>
                    ) : (
                      items.map((item) => (
                        <form key={item.id} action={toggleChecklistItem} className="flex items-start gap-2 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-2.5 text-sm">
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="workOrderId" value={workOrder.id} />
                          <input type="hidden" name="done" value={item.isDone ? "false" : "true"} />
                          <button type="submit" className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${item.isDone ? "border-[#4f9c76]/50 bg-[rgba(79,156,118,0.25)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[#4f9c76]/40"}`}>
                            {item.isDone ? <span className="text-[10px] text-[#bde7cf]">&#10003;</span> : null}
                          </button>
                          <span className={`text-sm ${item.isDone ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>{item.label}</span>
                        </form>
                      ))
                    )}
                  </div>
                );
              })}
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
