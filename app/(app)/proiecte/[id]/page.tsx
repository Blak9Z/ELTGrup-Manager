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
              <Link href={`/calendar?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[#152538] px-3 py-1.5 text-sm font-semibold text-[#d8e6fb] hover:border-[#4f6d8f]">
                Calendar
              </Link>
              <Link href={`/pontaj?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[#152538] px-3 py-1.5 text-sm font-semibold text-[#d8e6fb] hover:border-[#4f6d8f]">
                Pontaj
              </Link>
              <Link href={`/rapoarte-zilnice?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[#152538] px-3 py-1.5 text-sm font-semibold text-[#d8e6fb] hover:border-[#4f6d8f]">
                Rapoarte
              </Link>
              <Link href="/proiecte" className="rounded-xl border border-[var(--border)] bg-[#152538] px-3 py-1.5 text-sm font-semibold text-[#d8e6fb] hover:border-[#4f6d8f]">
                Inapoi
              </Link>
            </div>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Status</p>
            <div className="mt-2">
              <Badge tone={project.status === "ACTIVE" ? "success" : project.status === "BLOCKED" ? "danger" : "neutral"}>{project.status}</Badge>
            </div>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Buget estimat</p>
            <p className="mt-2 text-xl font-semibold text-[#f2f7ff]">{formatCurrency(project.estimatedBudget?.toString() || 0)}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Cost real</p>
            <p className="mt-2 text-xl font-semibold text-[#f2f7ff]">{formatCurrency(totalCost)}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Facturat</p>
            <p className="mt-2 text-xl font-semibold text-[#f2f7ff]">{formatCurrency(totalInvoiced)}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Lucrari active</h2>
            <div className="mt-3 space-y-2">
              {project.workOrders.map((task) => (
                <div key={task.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm">
                  <p className="font-semibold text-[#ecf2ff]">{task.title}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    Status {task.status} • Prioritate {task.priority} • Termen {task.dueDate ? formatDate(task.dueDate) : "-"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Faze proiect</h2>
            <div className="mt-3 space-y-2">
              {project.phases.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm">
                  <p className="font-semibold text-[#ecf2ff]">
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
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Consum materiale</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.materialUsage.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3">
                  <p className="font-semibold text-[#ecf2ff]">{item.material.name}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    Consum: {item.quantityUsed.toString()} {item.material.unitOfMeasure}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Facturi</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3">
                  <p className="font-semibold text-[#ecf2ff]">{invoice.invoiceNumber}</p>
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
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Documente proiect</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.documents.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3">
                  <p className="font-semibold text-[#ecf2ff]">{doc.title}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    {doc.category} • {doc.fileName}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Rapoarte zilnice</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.dailyReports.map((report) => (
                <div key={report.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3">
                  <p className="font-semibold text-[#ecf2ff]">{formatDate(report.reportDate)}</p>
                  <p className="text-xs text-[#a0b3ce]">{report.workCompleted}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-semibold text-[#f2f9ff]">Subcontractori</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {project.subcontractors.map((assignment) => (
              <div key={assignment.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm">
                <p className="font-semibold text-[#ecf2ff]">{assignment.subcontractor.name}</p>
                <p className="text-xs text-[#a0b3ce]">Status {assignment.status} • Contract {assignment.contractRef || "-"}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#f2f9ff]">Timeline proiect (operational)</h2>
          <p className="mt-1 text-xs text-[#9fb1c5]">Un singur fir cronologic pentru update-uri, documente, costuri, materiale, lucrari si facturi.</p>
          <div className="mt-3">
            <ActivityTimeline events={timeline} />
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
