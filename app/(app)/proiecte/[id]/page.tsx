import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { ActivityTimeline } from "@/src/components/ui/activity-timeline";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { assertProjectAccess } from "@/src/lib/access-scope";
import { buildProjectTimeline } from "@/src/lib/timeline";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (session?.user) {
    await assertProjectAccess(
      {
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      },
      id,
    ).catch(() => notFound());
  }

  const project = await prisma.project.findUnique({
    where: { id, deletedAt: null },
    include: {
      client: true,
      manager: true,
      phases: { orderBy: { position: "asc" } },
      workOrders: { where: { deletedAt: null }, orderBy: { dueDate: "asc" }, take: 15 },
      materialUsage: { include: { material: true }, orderBy: { loggedAt: "desc" }, take: 10 },
      invoices: { orderBy: { dueDate: "desc" }, take: 10 },
      costs: { orderBy: { occurredAt: "desc" }, take: 12 },
      documents: { orderBy: { createdAt: "desc" }, take: 12 },
      dailyReports: { orderBy: { reportDate: "desc" }, take: 10 },
      subcontractors: { include: { subcontractor: true }, take: 10 },
    },
  });

  if (!project) notFound();

  const totalCost = project.costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
  const totalInvoiced = project.invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  const timeline = await buildProjectTimeline(id, 40);

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title={project.title}
          subtitle={`${project.code} • ${project.client.name} • ${project.siteAddress}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/calendar?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Calendar
              </Link>
              <Link href={`/pontaj?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Pontaj
              </Link>
              <Link href={`/rapoarte-zilnice?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Rapoarte
              </Link>
              <Link href="/proiecte" className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Inapoi
              </Link>
            </div>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Status</p>
            <div className="mt-2">
              <Badge tone={project.status === "ACTIVE" ? "success" : project.status === "BLOCKED" ? "danger" : "neutral"}>{project.status}</Badge>
            </div>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Buget estimat</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatCurrency(project.estimatedBudget?.toString() || 0)}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Cost real</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatCurrency(totalCost)}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Facturat</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatCurrency(totalInvoiced)}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Lucrari active</h2>
            <div className="mt-3 space-y-2">
              {project.workOrders.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista lucrari active pe acest proiect.
                </p>
              ) : null}
              {project.workOrders.map((task) => (
                <div key={task.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{task.title}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    Status {task.status} • Prioritate {task.priority} • Termen {task.dueDate ? formatDate(task.dueDate) : "-"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Faze proiect</h2>
            <div className="mt-3 space-y-2">
              {project.phases.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista faze definite pentru acest proiect.
                </p>
              ) : null}
              {project.phases.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">
                    {phase.position}. {phase.title}
                  </p>
                  <p className="text-xs text-[#a0b3ce]">{phase.completed ? "Finalizata" : "In progres"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Consum materiale</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.materialUsage.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista consum de materiale inregistrat.
                </p>
              ) : null}
              {project.materialUsage.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{item.material.name}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    Consum: {item.quantityUsed.toString()} {item.material.unitOfMeasure}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Facturi</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.invoices.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista facturi asociate acestui proiect.
                </p>
              ) : null}
              {project.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    {formatCurrency(invoice.totalAmount.toString())} • Scadenta {formatDate(invoice.dueDate)} • {invoice.status}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Documente proiect</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.documents.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista documente incarcate pentru proiect.
                </p>
              ) : null}
              {project.documents.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{doc.title}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    {doc.category} • {doc.fileName}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Rapoarte zilnice</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.dailyReports.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista rapoarte zilnice in acest moment.
                </p>
              ) : null}
              {project.dailyReports.map((report) => (
                <div key={report.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{formatDate(report.reportDate)}</p>
                  <p className="text-xs text-[#a0b3ce]">{report.workCompleted}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Subcontractori</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {project.subcontractors.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)] md:col-span-2">
                Nu exista subcontractori alocati pe acest proiect.
              </p>
            ) : null}
            {project.subcontractors.map((assignment) => (
              <div key={assignment.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm">
                <p className="font-semibold text-[var(--foreground)]">{assignment.subcontractor.name}</p>
                <p className="text-xs text-[#a0b3ce]">Status {assignment.status} • Contract {assignment.contractRef || "-"}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Timeline proiect (operational)</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Un singur fir cronologic pentru update-uri, documente, costuri, materiale, lucrari si facturi.</p>
          <div className="mt-3">
            <ActivityTimeline events={timeline} />
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
