import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title={project.title}
          subtitle={`${project.code} • ${project.client.name} • ${project.siteAddress}`}
          actions={<Link href="/proiecte" className="text-sm font-semibold text-[#0f5b39] hover:underline">Inapoi la proiecte</Link>}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#5f7265]">Status</p>
            <div className="mt-2"><Badge tone={project.status === "ACTIVE" ? "success" : project.status === "BLOCKED" ? "danger" : "neutral"}>{project.status}</Badge></div>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#5f7265]">Buget estimat</p>
            <p className="mt-2 text-xl font-black">{formatCurrency(project.estimatedBudget?.toString() || 0)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#5f7265]">Cost real</p>
            <p className="mt-2 text-xl font-black">{formatCurrency(totalCost)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#5f7265]">Facturat</p>
            <p className="mt-2 text-xl font-black">{formatCurrency(totalInvoiced)}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="text-lg font-extrabold">Lucrari active</h2>
            <div className="mt-3 space-y-2">
              {project.workOrders.map((task) => (
                <div key={task.id} className="rounded-lg border border-[#dce8df] p-3 text-sm">
                  <p className="font-semibold">{task.title}</p>
                  <p className="text-xs text-[#5e7265]">Status {task.status} • Prioritate {task.priority} • Termen {task.dueDate ? formatDate(task.dueDate) : "-"}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-extrabold">Faze proiect</h2>
            <div className="mt-3 space-y-2">
              {project.phases.map((phase) => (
                <div key={phase.id} className="rounded-lg border border-[#e0ebe3] p-3 text-sm">
                  <p className="font-semibold">{phase.position}. {phase.title}</p>
                  <p className="text-xs text-[#607368]">{phase.completed ? "Finalizata" : "In progres"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-extrabold">Consum materiale</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.materialUsage.map((item) => (
                <div key={item.id} className="rounded-lg border border-[#dce8df] p-3">
                  <p className="font-semibold">{item.material.name}</p>
                  <p className="text-xs text-[#607368]">Consum: {item.quantityUsed.toString()} {item.material.unitOfMeasure}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-extrabold">Facturi</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-lg border border-[#dce8df] p-3">
                  <p className="font-semibold">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-[#607368]">{formatCurrency(invoice.totalAmount.toString())} • Scadenta {formatDate(invoice.dueDate)} • {invoice.status}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-extrabold">Documente proiect</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-[#dce8df] p-3">
                  <p className="font-semibold">{doc.title}</p>
                  <p className="text-xs text-[#607368]">{doc.category} • {doc.fileName}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-extrabold">Rapoarte zilnice</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.dailyReports.map((report) => (
                <div key={report.id} className="rounded-lg border border-[#dce8df] p-3">
                  <p className="font-semibold">{formatDate(report.reportDate)}</p>
                  <p className="text-xs text-[#607368]">{report.workCompleted}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-extrabold">Subcontractori</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {project.subcontractors.map((assignment) => (
              <div key={assignment.id} className="rounded-lg border border-[#dce8df] p-3 text-sm">
                <p className="font-semibold">{assignment.subcontractor.name}</p>
                <p className="text-xs text-[#607368]">Status {assignment.status} • Contract {assignment.contractRef || "-"}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
