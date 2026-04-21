import dynamic from "next/dynamic";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, workOrderScopeWhere } from "@/src/lib/access-scope";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";
import { createCalendarTaskAction } from "./actions";

const PlanningBoard = dynamic(() => import("./planning-board").then((module) => module.PlanningBoard), {
  loading: () => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="min-h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-[rgba(10,18,33,0.7)] p-3" />
      ))}
    </div>
  ),
});

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; teamId?: string; q?: string }>;
}) {
  const params = await searchParams;
  const trimmedQuery = params.q?.trim() || "";
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
  const canCreate = hasPermission(userContext.roleKeys || [], "TASKS", "CREATE", userContext.email);
  const allowedProjectId =
    params.projectId && (scope.projectIds === null || scope.projectIds.includes(params.projectId)) ? params.projectId : undefined;
  const allowedTeamId = params.teamId && (!scope.teamId || scope.teamId === params.teamId) ? params.teamId : undefined;

  const [projects, teams, workOrders] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.team.findMany({
      where: scope.teamId ? { deletedAt: null, id: scope.teamId } : { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        ...workOrderScopeWhere(userContext, scope),
        status: { not: "CANCELED" },
        projectId: allowedProjectId,
        teamId: allowedTeamId,
        title: trimmedQuery ? { contains: trimmedQuery, mode: "insensitive" } : undefined,
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        startDate: true,
        project: { select: { title: true } },
        team: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
      take: 80,
    }),
  ]);

  const weekday = ["Duminica", "Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata"];
  const tasks = workOrders.map((workOrder) => ({
    id: workOrder.id,
    title: workOrder.title,
    project: workOrder.project.title,
    team: workOrder.team?.name || "Nealocata",
    status: workOrder.status,
    priority: workOrder.priority,
    day: workOrder.startDate ? weekday[workOrder.startDate.getDay()] : "Luni",
    startDateIso: workOrder.startDate?.toISOString() ?? null,
  }));

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Calendar operational" subtitle="Planificare saptamanala cu detectie conflicte si reprogramare directa" />
        <Card className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Input name="q" placeholder="Cauta lucrare" defaultValue={trimmedQuery} />
            <select name="projectId" defaultValue={params.projectId || ""} className="h-10 rounded-lg border border-[var(--border)] bg-[rgba(9,18,32,0.7)] px-3 text-sm text-[var(--muted-strong)]">
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <select name="teamId" defaultValue={params.teamId || ""} className="h-10 rounded-lg border border-[var(--border)] bg-[rgba(9,18,32,0.7)] px-3 text-sm text-[var(--muted-strong)]">
              <option value="">Toate echipele</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Filtreaza
            </Button>
          </form>

          {canCreate ? (
            <form action={createCalendarTaskAction} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[rgba(12,22,39,0.8)] p-3 sm:grid-cols-2 xl:grid-cols-4">
              <Input name="title" placeholder="Adauga lucrare rapida in calendar" required />
              <select
                name="projectId"
                required
                defaultValue=""
                disabled={projects.length === 0}
                className="h-10 rounded-lg border border-[var(--border)] bg-[rgba(9,18,32,0.7)] px-3 text-sm text-[var(--muted-strong)]"
              >
                <option value="" disabled>
                  Selecteaza proiect
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              <select name="teamId" defaultValue="" className="h-10 rounded-lg border border-[var(--border)] bg-[rgba(9,18,32,0.7)] px-3 text-sm text-[var(--muted-strong)]">
                <option value="">Fara echipa</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select name="dayLabel" defaultValue="Luni" className="h-10 rounded-lg border border-[var(--border)] bg-[rgba(9,18,32,0.7)] px-3 text-sm text-[var(--muted-strong)]">
                  {["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"].map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <Button type="submit" className="h-10 w-full sm:w-auto" disabled={projects.length === 0}>
                  Adauga
                </Button>
              </div>
            </form>
          ) : null}

          {tasks.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-[rgba(10,18,33,0.7)] p-3 text-sm text-[var(--muted)]">
              Nu exista lucrari in calendar pentru filtrele curente.
            </p>
          ) : null}
          <PlanningBoard initialTasks={tasks} />
        </Card>
      </div>
    </PermissionGuard>
  );
}
