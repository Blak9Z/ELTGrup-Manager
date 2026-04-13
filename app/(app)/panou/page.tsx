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
      select: {
        id: true,
        title: true,
        startDate: true,
        status: true,
        description: true,
        project: { select: { title: true } },
        team: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
      take: 8,
    }),
    prisma.timeEntry.count({ where: { ...scopedProjectIdWhere, endAt: null } }),
    prisma.materialRequest.count({ where: { ...scopedProjectIdWhere, status: "PENDING" } }),
    prisma.invoice.aggregate({
      where: { ...scopedProjectIdWhere, status: { in: ["SENT", "OVERDUE", "PARTIAL_PAID"] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
      take: 8,
    }),
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

  const projectNameById = new Map(projectsById.map((project) => [project.id, project.title] as const));
  const chartData = weeklyHours.map((h) => ({
    name: (projectNameById.get(h.projectId) || "Proiect").slice(0, 18),
    ore: Math.round((h._sum.durationMinutes || 0) / 60),
  }));

  const receivables = Number(unpaidInvoices._sum.totalAmount || 0) - Number(unpaidInvoices._sum.paidAmount || 0);

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Operational Command Center"
          subtitle={roleContext.subtitle}
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Proiecte active" value={String(activeProjects)} helper="portofoliu executie" />
          <KpiCard label="Lucrari intarziate" value={String(delayedTasks)} helper="escaladare imediata" />
          <KpiCard label="Echipe in teren" value={String(clockedIn)} helper="pontaj activ" />
          <KpiCard label="Creante neincasate" value={formatCurrency(receivables)} helper="expunere financiara" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
          <Card className="p-0">
            <div className="border-b border-[var(--border)]/60 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Productivity</p>
              <h2 className="mt-1 text-xl font-semibold text-[#f2f9ff]">Ore facturabile pe proiect</h2>
              <p className="text-sm text-[#9cb0c4]">Concentrare pe proiectele cu cea mai mare incarcare</p>
            </div>
            <div className="px-4 pb-3 pt-2 sm:px-5">
              <ProductivityChart data={chartData} />
            </div>
          </Card>

          <Card className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Operational Alerts</p>
              <h2 className="mt-1 text-lg font-semibold text-[#f2f9ff]">Puncte critice</h2>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="rounded-xl border border-[rgba(197,83,98,0.45)] bg-[rgba(197,83,98,0.14)] px-3 py-2.5 text-[#ffd2d8]">
                {delayedTasks} lucrari depasite fata de termen
              </div>
              <div className="rounded-xl border border-[rgba(196,146,44,0.45)] bg-[rgba(196,146,44,0.13)] px-3 py-2.5 text-[#f4d694]">
                {pendingMaterialApprovals} cereri materiale in asteptare
              </div>
              <div className="rounded-xl border border-[rgba(63,141,221,0.45)] bg-[rgba(63,141,221,0.12)] px-3 py-2.5 text-[#c9e2ff]">
                {activeProjects} proiecte active sub monitorizare
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Role Focus</p>
            <h2 className="mt-1 text-lg font-semibold text-[#f0f8ff]">Prioritati pentru rolul tau</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {roleContext.focus.map((item, index) => (
                <div key={item} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm text-[#d7e7fb]">
                  <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-[#8ea4ba]">Prioritate {index + 1}</p>
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Recent Activity</p>
            <h2 className="mt-1 text-lg font-semibold text-[#f0f8ff]">Ultimele miscari in sistem</h2>
            <div className="mt-3 space-y-2.5">
              {latestActivities.map((log) => (
                <div key={log.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3">
                  <p className="text-sm font-semibold text-[#eaf4ff]">{log.action}</p>
                  <p className="text-xs text-[#a7bbd4]">
                    {fullName(log.user?.firstName, log.user?.lastName)} • {log.entityType} #{log.entityId.slice(-6)}
                  </p>
                  <p className="mt-1 text-xs text-[#8ea7c4]">{formatDate(log.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card className="p-0">
          <div className="border-b border-[var(--border)]/60 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Execution Planning</p>
            <h2 className="mt-1 text-lg font-semibold text-[#f0f8ff]">Program echipe astazi</h2>
          </div>
          <div className="p-3 sm:p-4">
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Quick Insights</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm text-[#d7e7fb]">
              <p className="text-xs text-[#9db0c5]">Ritm executie</p>
              <p className="mt-1 font-semibold text-[#eef7ff]">{todaySchedule.length} taskuri planificate azi</p>
            </div>
            <div className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm text-[#d7e7fb]">
              <p className="text-xs text-[#9db0c5]">Flux financiar</p>
              <p className="mt-1 font-semibold text-[#eef7ff]">{formatCurrency(receivables)} neincasat</p>
            </div>
            <div className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm text-[#d7e7fb]">
              <p className="text-xs text-[#9db0c5]">Aprobari necesare</p>
              <p className="mt-1 font-semibold text-[#eef7ff]">{pendingMaterialApprovals} cereri materiale pending</p>
            </div>
          </div>
        </Card>

      </div>
    </PermissionGuard>
  );
}
