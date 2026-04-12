import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { KpiCard } from "@/src/components/ui/kpi-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { TD, TH, Table } from "@/src/components/ui/table";
import { formatCurrency, formatDate, fullName } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { ProductivityChart } from "@/src/modules/dashboard/charts";

export default async function DashboardPage() {
  const [
    activeProjects,
    delayedTasks,
    todaySchedule,
    clockedIn,
    pendingMaterialApprovals,
    unpaidInvoices,
    latestActivities,
    weeklyHours,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.workOrder.count({ where: { dueDate: { lt: new Date() }, status: { notIn: ["DONE", "CANCELED"] }, deletedAt: null } }),
    prisma.workOrder.findMany({
      where: { deletedAt: null, startDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      include: { project: true, team: true },
      orderBy: { startDate: "asc" },
      take: 8,
    }),
    prisma.timeEntry.count({ where: { endAt: null } }),
    prisma.materialRequest.count({ where: { status: "PENDING" } }),
    prisma.invoice.aggregate({
      where: { status: { in: ["SENT", "OVERDUE", "PARTIAL_PAID"] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, include: { user: true }, take: 8 }),
    prisma.timeEntry.groupBy({
      by: ["projectId"],
      _sum: { durationMinutes: true },
      orderBy: { _sum: { durationMinutes: "desc" } },
      take: 6,
    }),
  ]);

  const projectsById = await prisma.project.findMany({
    where: { id: { in: weeklyHours.map((h) => h.projectId) } },
    select: { id: true, title: true },
  });

  const chartData = weeklyHours.map((h) => ({
    name: projectsById.find((p) => p.id === h.projectId)?.title.slice(0, 18) || "Proiect",
    ore: Math.round((h._sum.durationMinutes || 0) / 60),
  }));

  const receivables = Number(unpaidInvoices._sum.totalAmount || 0) - Number(unpaidInvoices._sum.paidAmount || 0);

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Panou operational"
          subtitle="Vizibilitate in timp real pentru proiecte, echipe, pontaj si cashflow operational"
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Proiecte active" value={String(activeProjects)} helper="In executie" />
          <KpiCard label="Lucrari intarziate" value={String(delayedTasks)} helper="Necesita interventie manager" />
          <KpiCard label="Echipe active acum" value={String(clockedIn)} helper="Cu pontaj deschis" />
          <KpiCard label="Creante neincasate" value={formatCurrency(receivables)} helper="Facturi neplatite" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <h2 className="text-lg font-extrabold">Productivitate ore pe proiect</h2>
            <p className="mt-1 text-sm text-[#5e7265]">Suma orelor inregistrate in pontaj</p>
            <ProductivityChart data={chartData} />
          </Card>
          <Card>
            <h2 className="text-lg font-extrabold">Alerte rapide</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg border border-[#f2d3d5] bg-[#fff2f3] p-3">{delayedTasks} lucrari depasite termen</div>
              <div className="rounded-lg border border-[#f6e8c8] bg-[#fff8e9] p-3">{pendingMaterialApprovals} cereri materiale in asteptare</div>
              <div className="rounded-lg border border-[#cce5d5] bg-[#eefaf2] p-3">{activeProjects} proiecte active in monitorizare</div>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-extrabold">Program echipe astazi</h2>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <TH>Ora</TH>
                    <TH>Lucrare</TH>
                    <TH>Proiect</TH>
                    <TH>Echipa</TH>
                    <TH>Status</TH>
                  </tr>
                </thead>
                <tbody>
                  {todaySchedule.map((item) => (
                    <tr key={item.id}>
                      <TD>{item.startDate ? formatDate(item.startDate) : "-"}</TD>
                      <TD className="font-semibold">{item.title}</TD>
                      <TD>{item.project.title}</TD>
                      <TD>{item.team?.name || "Nealocata"}</TD>
                      <TD>
                        <Badge tone={item.status === "IN_PROGRESS" ? "info" : item.status === "BLOCKED" ? "danger" : item.status === "DONE" ? "success" : "neutral"}>
                          {item.status}
                        </Badge>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-extrabold">Activitate recenta</h2>
            <div className="mt-4 space-y-3">
              {latestActivities.map((log) => (
                <div key={log.id} className="rounded-lg border border-[#e5eee8] bg-[#f8fbf9] p-3">
                  <p className="text-sm font-semibold text-[#1d2e23]">{log.action}</p>
                  <p className="text-xs text-[#5f7265]">
                    {fullName(log.user?.firstName, log.user?.lastName)} • {log.entityType} #{log.entityId.slice(-6)}
                  </p>
                  <p className="mt-1 text-xs text-[#61776a]">{formatDate(log.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
