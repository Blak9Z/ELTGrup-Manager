import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, workOrderScopeWhere } from "@/src/lib/access-scope";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";

type ProjectMetric = {
  projectId: string;
  title: string;
  planned: number;
  actual: number;
};

export default async function AnaliticePage() {
  const session = await auth();
  const userContext = session?.user
    ? { id: session.user.id, email: session.user.email, roleKeys: session.user.roleKeys || [] }
    : { id: "", email: null, roleKeys: [] };
  const scope = session?.user ? await resolveAccessScope(userContext) : { projectIds: null, teamId: null };
  const scopedProjectFilter = scope.projectIds === null ? undefined : { in: scope.projectIds.length ? scope.projectIds : ["__none__"] };
  const scopedWorkOrderWhere = { ...workOrderScopeWhere(userContext, scope), deletedAt: null };

  const [projects, delayedWorkOrders, workOrdersWithEstimates, timeByWorkOrder, approvedMaterialByProject, usedMaterialByProject, costByProject, invoiceTotals, overdueInvoiceCount] =
    await Promise.all([
      prisma.project.findMany({
        where: { deletedAt: null, ...(scope.projectIds === null ? {} : { id: scopedProjectFilter }) },
        select: { id: true, title: true, estimatedBudget: true },
      }),
      prisma.workOrder.findMany({
        where: {
          ...scopedWorkOrderWhere,
          dueDate: { lt: new Date() },
          status: { notIn: ["DONE", "CANCELED"] },
        },
        include: { project: { select: { title: true } } },
        orderBy: { dueDate: "asc" },
        take: 12,
      }),
      prisma.workOrder.findMany({
        where: {
          ...scopedWorkOrderWhere,
          estimatedHours: { not: null },
          status: { not: "CANCELED" },
        },
        select: { id: true, title: true, estimatedHours: true, project: { select: { title: true } } },
        take: 200,
      }),
      prisma.timeEntry.groupBy({
        by: ["workOrderId"],
        where: {
          ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter }),
          workOrderId: { not: null },
        },
        _sum: { durationMinutes: true },
      }),
      prisma.materialRequest.groupBy({
        by: ["projectId"],
        where: {
          ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter }),
          status: "APPROVED",
        },
        _sum: { quantity: true },
      }),
      prisma.projectMaterialUsage.groupBy({
        by: ["projectId"],
        where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter },
        _sum: { quantityUsed: true },
      }),
      prisma.costEntry.groupBy({
        by: ["projectId"],
        where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.invoice.count({
        where: {
          ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter }),
          status: "OVERDUE",
        },
      }),
    ]);

  const timeByWorkOrderMap = new Map(timeByWorkOrder.map((row) => [row.workOrderId, row._sum.durationMinutes || 0]));
  const approvedMaterialMap = new Map(approvedMaterialByProject.map((row) => [row.projectId, Number(row._sum.quantity || 0)]));
  const usedMaterialMap = new Map(usedMaterialByProject.map((row) => [row.projectId, Number(row._sum.quantityUsed || 0)]));
  const costMap = new Map(costByProject.map((row) => [row.projectId, Number(row._sum.amount || 0)]));

  const hoursVsEstimate = workOrdersWithEstimates
    .map((workOrder) => {
      const plannedHours = Number(workOrder.estimatedHours || 0);
      const actualHours = Math.round((timeByWorkOrderMap.get(workOrder.id) || 0) / 60);
      const variance = actualHours - plannedHours;
      return { ...workOrder, plannedHours, actualHours, variance };
    })
    .sort((a, b) => b.variance - a.variance)
    .slice(0, 10);

  const materialsVsPlan: ProjectMetric[] = projects
    .map((project) => ({
      projectId: project.id,
      title: project.title,
      planned: approvedMaterialMap.get(project.id) || 0,
      actual: usedMaterialMap.get(project.id) || 0,
    }))
    .filter((row) => row.planned > 0 || row.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 10);

  const costVsBudget: ProjectMetric[] = projects
    .map((project) => ({
      projectId: project.id,
      title: project.title,
      planned: Number(project.estimatedBudget || 0),
      actual: costMap.get(project.id) || 0,
    }))
    .sort((a, b) => (b.actual - b.planned) - (a.actual - a.planned))
    .slice(0, 10);

  const totalInvoiced = Number(invoiceTotals._sum.totalAmount || 0);
  const totalPaid = Number(invoiceTotals._sum.paidAmount || 0);
  const receivable = totalInvoiced - totalPaid;
  const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Analitice operationale"
          subtitle="Semnale reale pentru decizie: intarzieri, ore vs estimat, materiale vs plan, cost vs buget, facturi/plati"
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Lucrari intarziate</p>
            <p className="mt-2 text-2xl font-black">{delayedWorkOrders.length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Ore peste estimat</p>
            <p className="mt-2 text-2xl font-black">{hoursVsEstimate.filter((item) => item.variance > 0).length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Materiale peste plan</p>
            <p className="mt-2 text-2xl font-black">{materialsVsPlan.filter((item) => item.actual > item.planned).length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Cost peste buget</p>
            <p className="mt-2 text-2xl font-black">{costVsBudget.filter((item) => item.actual > item.planned).length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Facturi restante</p>
            <p className="mt-2 text-2xl font-black">{overdueInvoiceCount}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Lucrari intarziate (actiune imediata)</h2>
            <div className="mt-3 space-y-2">
              {delayedWorkOrders.length === 0 ? <p className="text-sm text-[var(--muted)]">Nicio lucrare intarziata in aria ta.</p> : null}
              {delayedWorkOrders.map((workOrder) => (
                <div key={workOrder.id} className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{workOrder.title}</p>
                    <Badge tone="danger">{workOrder.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {workOrder.project.title} • termen {workOrder.dueDate ? formatDate(workOrder.dueDate) : "-"}
                  </p>
                  <Link className="mt-2 inline-block text-xs font-semibold text-[#c6dbff] hover:underline" href={`/lucrari/${workOrder.id}`}>
                    Deschide lucrare
                  </Link>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Ore pontate vs ore estimate</h2>
            <div className="mt-3 space-y-2">
              {hoursVsEstimate.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3 text-sm text-[var(--muted)]">
                  Nu exista suficiente date de pontaj/estimare pentru comparatie.
                </p>
              ) : null}
              {hoursVsEstimate.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {item.project.title} • estimate {item.plannedHours}h • pontate {item.actualHours}h
                  </p>
                  <p className={`mt-1 text-xs font-semibold ${item.variance > 0 ? "text-[#ffb9c1]" : "text-[#b6f3ce]"}`}>
                    Variatie: {item.variance > 0 ? "+" : ""}{item.variance}h
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Materiale consumate vs aprobate</h2>
            <div className="mt-3 space-y-2">
              {materialsVsPlan.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3 text-sm text-[var(--muted)]">
                  Nu exista date de consum/aprobare materiale pentru proiectele vizibile.
                </p>
              ) : null}
              {materialsVsPlan.map((item) => (
                <div key={item.projectId} className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                  <p className="text-xs text-[var(--muted)]">Aprobate {item.planned.toFixed(2)} • Consumate {item.actual.toFixed(2)}</p>
                  <p className={`mt-1 text-xs font-semibold ${item.actual > item.planned ? "text-[#ffb9c1]" : "text-[#b6f3ce]"}`}>
                    Diferenta: {(item.actual - item.planned).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Cost real vs buget estimat</h2>
            <div className="mt-3 space-y-2">
              {costVsBudget.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3 text-sm text-[var(--muted)]">
                  Nu exista proiecte cu date suficiente pentru analiza cost vs buget.
                </p>
              ) : null}
              {costVsBudget.map((item) => (
                <div key={item.projectId} className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                  <p className="text-xs text-[var(--muted)]">Buget {formatCurrency(item.planned)} • Cost {formatCurrency(item.actual)}</p>
                  <p className={`mt-1 text-xs font-semibold ${item.actual > item.planned ? "text-[#ffb9c1]" : "text-[#b6f3ce]"}`}>
                    Variatie: {formatCurrency(item.actual - item.planned)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Facturi si plati</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3">
              <p className="text-xs text-[var(--muted)]">Total facturat</p>
              <p className="mt-1 font-semibold text-[var(--foreground)]">{formatCurrency(totalInvoiced)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3">
              <p className="text-xs text-[var(--muted)]">Total incasat</p>
              <p className="mt-1 font-semibold text-[var(--foreground)]">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))] p-3">
              <p className="text-xs text-[var(--muted)]">Creanta + rata incasare</p>
              <p className="mt-1 font-semibold text-[var(--foreground)]">{formatCurrency(receivable)} • {collectionRate}%</p>
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
