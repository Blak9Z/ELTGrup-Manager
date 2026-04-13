import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { formatCurrency } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";

export default async function AnaliticePage() {
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const scopedProjectFilter = scope.projectIds === null ? undefined : { in: scope.projectIds.length ? scope.projectIds : ["__none__"] };

  const [hoursByProject, materialUsage, delayedWorks, equipmentUtilization, projects, invoices, costs] = await Promise.all([
    prisma.timeEntry.groupBy({
      by: ["projectId"],
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter },
      _sum: { durationMinutes: true },
      orderBy: { _sum: { durationMinutes: "desc" } },
      take: 10,
    }),
    prisma.projectMaterialUsage.groupBy({
      by: ["projectId"],
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter },
      _sum: { quantityUsed: true },
      orderBy: { _sum: { quantityUsed: "desc" } },
      take: 10,
    }),
    prisma.workOrder.count({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: ["DONE", "CANCELED"] },
        ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter }),
      },
    }),
    prisma.equipmentAssignment.groupBy({
      by: ["equipmentId"],
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter },
      _sum: { usageHours: true },
      orderBy: { _sum: { usageHours: "desc" } },
      take: 10,
    }),
    prisma.project.findMany({
      where: { deletedAt: null, ...(scope.projectIds === null ? {} : { id: scopedProjectFilter }) },
      select: { id: true, title: true },
      take: 100,
    }),
    prisma.invoice.findMany({
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter },
      select: { projectId: true, totalAmount: true, paidAmount: true },
    }),
    prisma.costEntry.findMany({
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter },
      select: { projectId: true, amount: true },
    }),
  ]);

  const projectMap = new Map(projects.map((p) => [p.id, p.title]));

  const marginByProject = projects
    .map((project) => {
      const invoiced = invoices.filter((item) => item.projectId === project.id).reduce((sum, item) => sum + Number(item.totalAmount), 0);
      const cost = costs.filter((item) => item.projectId === project.id).reduce((sum, item) => sum + Number(item.amount), 0);
      return { id: project.id, title: project.title, invoiced, cost, margin: invoiced - cost };
    })
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 8);

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Analitice operationale" subtitle="Performanta proiecte, consum, marje, intarzieri si utilizare echipamente" />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#9fb3ce]">Proiecte cu ore raportate</p>
            <p className="mt-2 text-2xl font-black">{hoursByProject.length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#9fb3ce]">Consum materiale monitorizat</p>
            <p className="mt-2 text-2xl font-black">{materialUsage.length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#9fb3ce]">Lucrari intarziate</p>
            <p className="mt-2 text-2xl font-black">{delayedWorks}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#9fb3ce]">Echipamente cu utilizare</p>
            <p className="mt-2 text-2xl font-black">{equipmentUtilization.length}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Top proiecte dupa ore pontate</h2>
            <div className="mt-3 space-y-2">
              {hoursByProject.map((item) => (
                <div key={item.projectId} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3 text-sm">
                  <p className="font-semibold text-[#edf4ff]">{projectMap.get(item.projectId) || "Proiect"}</p>
                  <p className="text-xs text-[#9fb2cd]">{Math.round((item._sum.durationMinutes || 0) / 60)} ore raportate</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Top proiecte dupa marja estimata</h2>
            <div className="mt-3 space-y-2">
              {marginByProject.map((item) => (
                <div key={item.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3 text-sm">
                  <p className="font-semibold text-[#edf4ff]">{item.title}</p>
                  <p className="text-xs text-[#9fb2cd]">Facturat {formatCurrency(item.invoiced)} • Cost {formatCurrency(item.cost)} • Marja {formatCurrency(item.margin)}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
