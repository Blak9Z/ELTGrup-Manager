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
    focus: ["Confirma cererile de materiale ramase in asteptare.", "Verifica lucrarile care depasesc termenul."],
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
    focus: ["Verifica costurile nou inregistrate.", "Urmareste facturile scadente si soldul neincasat."],
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
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const scopedWorkOrderIds =
    scope.projectIds === null
      ? null
      : scope.projectIds.length === 0
        ? []
        : (
          await prisma.workOrder.findMany({
            where: scopedWorkOrderWhere,
            select: { id: true },
            orderBy: { id: "asc" },
            take: 250,
          })
        ).map((item) => item.id);
  const primaryRole = getPrimaryRole(userContext.roleKeys);
  const roleContext = roleExperience[primaryRole];

  const delayedTasks = await prisma.workOrder.count({
    where: { ...scopedWorkOrderWhere, dueDate: { lt: new Date() }, status: { notIn: ["DONE", "CANCELED"] } },
  });
  const todaySchedule = await prisma.workOrder.findMany({
    where: { ...scopedWorkOrderWhere, startDate: { gte: startOfToday } },
    select: {
      id: true,
      title: true,
      startDate: true,
      status: true,
      description: true,
      project: { select: { title: true } },
      team: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    take: 10,
  });
  const clockedIn = await prisma.timeEntry.count({ where: { ...scopedProjectIdWhere, endAt: null } });
  const pendingMaterialApprovals = await prisma.materialRequest.count({ where: { ...scopedProjectIdWhere, status: "PENDING" } });
  const unpaidInvoices = await prisma.invoice.aggregate({
    where: { ...scopedProjectIdWhere, status: { in: ["SENT", "OVERDUE", "PARTIAL_PAID"] } },
    _sum: { totalAmount: true, paidAmount: true },
  });
  const latestActivities = await prisma.activityLog.findMany({
    where:
      scope.projectIds === null
        ? undefined
        : {
            OR: [
              { entityType: "PROJECT", entityId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
              {
                entityType: "WORK_ORDER",
                entityId: { in: scopedWorkOrderIds && scopedWorkOrderIds.length ? scopedWorkOrderIds : ["__none__"] },
              },
            ],
          },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
    take: 8,
  });
  const weeklyHours = await prisma.timeEntry.groupBy({
    by: ["projectId"],
    where: scopedProjectIdWhere,
    _sum: { durationMinutes: true },
    orderBy: [{ _sum: { durationMinutes: "desc" } }, { projectId: "asc" }],
    take: 6,
  });
  const projectStatusBuckets = await prisma.project.groupBy({
    by: ["status"],
    where: { deletedAt: null, ...scopedProjectWhere },
    _count: { _all: true },
  });
  const workOrderStatusBuckets = await prisma.workOrder.groupBy({
    by: ["status"],
    where: scopedWorkOrderWhere,
    _count: { _all: true },
  });

  const projectsById =
    weeklyHours.length === 0
      ? []
      : await prisma.project.findMany({
          where: {
            deletedAt: null,
            AND: [{ id: { in: weeklyHours.map((h) => h.projectId) } }, scopedProjectWhere],
          },
          select: { id: true, title: true },
        });

  const projectNameById = new Map(projectsById.map((project) => [project.id, project.title] as const));
  const chartData = weeklyHours.map((hourItem) => ({
    name: (projectNameById.get(hourItem.projectId) || "Proiect").slice(0, 18),
    ore: Math.round((hourItem._sum.durationMinutes || 0) / 60),
  }));
  const projectCountByStatus = new Map(projectStatusBuckets.map((item) => [item.status, item._count._all]));
  const workOrderCountByStatus = new Map(workOrderStatusBuckets.map((item) => [item.status, item._count._all]));
  const activeProjects = projectCountByStatus.get("ACTIVE") || 0;
  const plannedProjects = projectCountByStatus.get("PLANNED") || 0;
  const blockedProjects = projectCountByStatus.get("BLOCKED") || 0;
  const completedProjects = projectCountByStatus.get("COMPLETED") || 0;
  const todoOrders = workOrderCountByStatus.get("TODO") || 0;
  const inProgressOrders = workOrderCountByStatus.get("IN_PROGRESS") || 0;
  const blockedOrders = workOrderCountByStatus.get("BLOCKED") || 0;

  const receivables = Number(unpaidInvoices._sum.totalAmount || 0) - Number(unpaidInvoices._sum.paidAmount || 0);

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="page-stack">
        <PageHeader title="Panou operational" subtitle={roleContext.subtitle} />

        <section className="page-kpis">
          <KpiCard label="Proiecte active" value={String(activeProjects)} helper="in executie" />
          <KpiCard label="Lucrari intarziate" value={String(delayedTasks)} helper="necesita interventie" />
          <KpiCard label="Pontaje active" value={String(clockedIn)} helper="echipe in teren" />
          <KpiCard label="Cereri materiale" value={String(pendingMaterialApprovals)} helper="in asteptare" />
          <KpiCard label="Creante neincasate" value={formatCurrency(receivables)} helper="expunere curenta" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <Card className="p-0">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Privire generala</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">Ore facturabile pe proiect</h2>
              <p className="text-sm text-[var(--muted)]">Distribuie atentia manageriala pe proiectele cu incarcare ridicata.</p>
            </div>
            <div className="px-4 pb-2 pt-2 sm:px-5">
              <ProductivityChart data={chartData} />
            </div>
            <div className="grid gap-2 border-t border-[var(--border)] px-5 py-4 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Ritm executie</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{todaySchedule.length} taskuri planificate azi</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Flux financiar</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatCurrency(receivables)} neincasat</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Aprobari materiale</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{pendingMaterialApprovals} in asteptare</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Activitate recenta</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Ultimele miscari in sistem</h2>
            <div className="mt-3 space-y-2">
              {latestActivities.length === 0 ? (
                <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista activitate recenta in aria ta de acces.
                </p>
              ) : null}
              {latestActivities.map((log) => (
                <div key={log.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{log.action}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {fullName(log.user?.firstName, log.user?.lastName)} • {log.entityType} #{log.entityId.slice(-6)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(log.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Status proiecte</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Portofoliu proiecte</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2">
                <span className="text-[var(--muted-strong)]">Planificate</span>
                <span className="font-semibold text-[var(--foreground)]">{plannedProjects}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2">
                <span className="text-[var(--muted-strong)]">Active</span>
                <span className="font-semibold text-[var(--foreground)]">{activeProjects}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2">
                <span className="text-[var(--muted-strong)]">Blocate</span>
                <span className="font-semibold text-[var(--foreground)]">{blockedProjects}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2">
                <span className="text-[var(--muted-strong)]">Finalizate</span>
                <span className="font-semibold text-[var(--foreground)]">{completedProjects}</span>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Status echipe</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Task si echipe</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2">
                <span className="text-[var(--muted-strong)]">Taskuri TODO</span>
                <span className="font-semibold text-[var(--foreground)]">{todoOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2">
                <span className="text-[var(--muted-strong)]">In progres</span>
                <span className="font-semibold text-[var(--foreground)]">{inProgressOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2">
                <span className="text-[var(--muted-strong)]">Blocate</span>
                <span className="font-semibold text-[var(--foreground)]">{blockedOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2">
                <span className="text-[var(--muted-strong)]">Pontaj activ</span>
                <span className="font-semibold text-[var(--foreground)]">{clockedIn}</span>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Focus pe rol</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Prioritati pentru rolul tau</h2>
            <div className="mt-3 space-y-2">
              {roleContext.focus.map((item, index) => (
                <div key={item} className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[var(--muted-strong)]">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Prioritate {index + 1}</p>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card className="p-0">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Planificare executie</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Program echipe astazi</h2>
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
      </div>
    </PermissionGuard>
  );
}
