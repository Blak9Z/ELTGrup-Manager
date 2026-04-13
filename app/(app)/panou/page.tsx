import { RoleKey } from "@prisma/client";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Card } from "@/src/components/ui/card";
import { KpiCard } from "@/src/components/ui/kpi-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { DashboardScheduleTable } from "@/src/components/dashboard/schedule-table";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, workOrderScopeWhere } from "@/src/lib/access-scope";
import { formatCurrency, formatDate, fullName } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { ProductivityChart } from "@/src/modules/dashboard/charts";

function getPrimaryRole(roleKeys: string[]) {
  const priority: RoleKey[] = [
    RoleKey.SUPER_ADMIN,
    RoleKey.ADMINISTRATOR,
    RoleKey.PROJECT_MANAGER,
    RoleKey.SITE_MANAGER,
    RoleKey.BACKOFFICE,
    RoleKey.ACCOUNTANT,
    RoleKey.WORKER,
    RoleKey.CLIENT_VIEWER,
    RoleKey.SUBCONTRACTOR,
  ];
  return priority.find((role) => roleKeys.includes(role)) || RoleKey.WORKER;
}

const roleExperience: Record<RoleKey, { subtitle: string; focus: string[] }> = {
  SUPER_ADMIN: {
    subtitle: "Control global: risc operational, marja, cashflow si blocaje critice",
    focus: ["Revizuieste analiticele si facturile restante.", "Intervine pe proiectele cu lucrari intarziate."],
  },
  ADMINISTRATOR: {
    subtitle: "Coordonare executie: proiecte active, alocare echipe, aprobari materiale",
    focus: ["Confirma cererile de materiale ramase in pending.", "Verifica lucrarile care depasesc termenul."],
  },
  PROJECT_MANAGER: {
    subtitle: "Management proiect: termene, progres, consum materiale, buget",
    focus: ["Compara orele pontate cu orele estimate.", "Urmareste costurile fata de bugetul proiectului."],
  },
  SITE_MANAGER: {
    subtitle: "Executie santier: taskuri zilnice, pontaj live, blocaje teren",
    focus: ["Actualizeaza rapid rapoartele din teren.", "Escaladeaza imediat lucrarile blocate."],
  },
  BACKOFFICE: {
    subtitle: "Operatiuni suport: documente, taskuri administrative, fluxuri materiale",
    focus: ["Asigura completitudinea documentelor de proiect.", "Curata cererile materiale blocate in asteptare."],
  },
  ACCOUNTANT: {
    subtitle: "Control financiar: costuri proiect, facturare, plati si restante",
    focus: ["Verifica costurile nou inregistrate.", "Urmareste facturile overdue si soldul neincasat."],
  },
  WORKER: {
    subtitle: "Executie personala: lucrari alocate, pontaj, update progres",
    focus: ["Porneste/opreste pontajul pe lucrarile curente.", "Trimite update teren cu blocajele de azi."],
  },
  CLIENT_VIEWER: {
    subtitle: "Vizibilitate client: progres, documente relevante, rapoarte",
    focus: ["Consulta timeline-ul proiectelor alocate.", "Verifica ultimele rapoarte si documente publice."],
  },
  SUBCONTRACTOR: {
    subtitle: "Executie subcontractor: taskuri alocate, livrabile si documente",
    focus: ["Actualizeaza taskurile proprii.", "Incarca dovada de executie in documente."],
  },
};

export default async function DashboardPage() {
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const userContext = session?.user
    ? { id: session.user.id, email: session.user.email, roleKeys: session.user.roleKeys || [] }
    : { id: "", email: null, roleKeys: [] };
  const scopedProjectWhere = scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } };
  const scopedProjectIdWhere = scope.projectIds === null ? {} : { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } };
  const scopedWorkOrderWhere = { ...workOrderScopeWhere(userContext, scope), deletedAt: null };
  const primaryRole = getPrimaryRole(userContext.roleKeys);
  const roleContext = roleExperience[primaryRole];

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
    prisma.project.count({ where: { status: "ACTIVE", deletedAt: null, ...scopedProjectWhere } }),
    prisma.workOrder.count({ where: { ...scopedWorkOrderWhere, dueDate: { lt: new Date() }, status: { notIn: ["DONE", "CANCELED"] } } }),
    prisma.workOrder.findMany({
      where: { ...scopedWorkOrderWhere, startDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      include: { project: true, team: true },
      orderBy: { startDate: "asc" },
      take: 8,
    }),
    prisma.timeEntry.count({ where: { ...scopedProjectIdWhere, endAt: null } }),
    prisma.materialRequest.count({ where: { ...scopedProjectIdWhere, status: "PENDING" } }),
    prisma.invoice.aggregate({
      where: { ...scopedProjectIdWhere, status: { in: ["SENT", "OVERDUE", "PARTIAL_PAID"] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, include: { user: true }, take: 8 }),
    prisma.timeEntry.groupBy({
      by: ["projectId"],
      where: scopedProjectIdWhere,
      _sum: { durationMinutes: true },
      orderBy: { _sum: { durationMinutes: "desc" } },
      take: 6,
    }),
  ]);

  const projectsById = await prisma.project.findMany({
    where: {
      deletedAt: null,
      AND: [
        { id: { in: weeklyHours.map((h) => h.projectId) } },
        scopedProjectWhere,
      ],
    },
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
          subtitle={roleContext.subtitle}
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Proiecte active" value={String(activeProjects)} helper="In executie" />
          <KpiCard label="Lucrari intarziate" value={String(delayedTasks)} helper="Necesita interventie" />
          <KpiCard label="Echipe in teren" value={String(clockedIn)} helper="Cu pontaj deschis" />
          <KpiCard label="Creante neincasate" value={formatCurrency(receivables)} helper="Facturi restante" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <h2 className="text-lg font-semibold text-[#f0f5ff]">Productivitate ore pe proiect</h2>
            <p className="mt-1 text-sm text-[#9fb2cd]">Ore inregistrate in pontajul ultimelor intervale</p>
            <ProductivityChart data={chartData} />
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[#f0f5ff]">Alerte operationale</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border border-[rgba(217,95,106,0.45)] bg-[rgba(217,95,106,0.16)] p-3 text-[#ffc8cf]">
                {delayedTasks} lucrari depasite fata de termen
              </div>
              <div className="rounded-xl border border-[rgba(213,170,69,0.45)] bg-[rgba(213,170,69,0.16)] p-3 text-[#f4d483]">
                {pendingMaterialApprovals} cereri materiale in asteptare
              </div>
              <div className="rounded-xl border border-[rgba(95,160,255,0.4)] bg-[rgba(95,160,255,0.15)] p-3 text-[#c4dcff]">
                {activeProjects} proiecte active sub monitorizare
              </div>
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-semibold text-[#f0f5ff]">Focus pentru rolul tau</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {roleContext.focus.map((item) => (
              <div key={item} className="rounded-xl border border-[color:var(--border)] bg-[rgba(15,25,44,0.72)] p-3 text-sm text-[#d7e4f8]">
                {item}
              </div>
            ))}
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[#f0f5ff]">Program echipe astazi</h2>
            <div className="mt-4">
              <DashboardScheduleTable
                items={todaySchedule.map((item) => ({
                  id: item.id,
                  title: item.title,
                  startLabel: item.startDate ? formatDate(item.startDate) : "-",
                  projectTitle: item.project.title,
                  teamName: item.team?.name || "Nealocata",
                  status: item.status,
                  description: item.description || "",
                }))}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#f0f5ff]">Activitate recenta</h2>
            <div className="mt-4 space-y-3">
              {latestActivities.map((log) => (
                <div key={log.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(15,25,44,0.72)] p-3">
                  <p className="text-sm font-semibold text-[#eaf1fd]">{log.action}</p>
                  <p className="text-xs text-[#a7bad3]">
                    {fullName(log.user?.firstName, log.user?.lastName)} • {log.entityType} #{log.entityId.slice(-6)}
                  </p>
                  <p className="mt-1 text-xs text-[#8ea2bf]">{formatDate(log.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
